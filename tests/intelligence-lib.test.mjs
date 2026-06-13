import { describe, expect, it } from 'vitest';
import {
  extractEntities,
  extractRepositoryIdeas,
  intelligenceHash,
  isDuplicate,
  matchWatchlist,
  normalizeNewsItem,
  normalizeTitle,
  scoreIntelligenceItem,
  titleSimilarity,
} from '../scripts/intelligence-lib.mjs';

describe('intelligence normalization', () => {
  it('normalizes provider items into the unified schema', () => {
    const item = normalizeNewsItem(
      {
        title: '<b>Critical CVE-2026-12345 in Firebase</b>',
        url: 'https://example.com/security',
        description: 'A vulnerability affects Firebase and Cloud Run.',
        publishedAt: '2026-06-13T00:00:00Z',
      },
      { id: 'source-1', name: 'Security Feed', provider: 'rss', priority: 95, language: 'en' },
    );
    expect(item.title).toBe('Critical CVE-2026-12345 in Firebase');
    expect(item.provider).toBe('rss');
    expect(item.entities.cves).toEqual(['CVE-2026-12345']);
    expect(item.entities.cloudProducts).toContain('Firebase');
    expect(item.hash).toHaveLength(64);
    expect(item.score).toBeGreaterThan(50);
  });

  it('produces stable hashes and normalized titles', () => {
    expect(intelligenceHash(['A', 'B'])).toBe(intelligenceHash([' a ', 'b']));
    expect(normalizeTitle('  Hello, World! ')).toBe('hello world');
  });
});

describe('intelligence scoring and entities', () => {
  it('scores recent security intelligence above generic old content', () => {
    const now = '2026-06-13T12:00:00Z';
    const important = scoreIntelligenceItem(
      {
        title: 'Critical CVE exploit causes ransomware breach in Saudi Arabia',
        summary: 'Threat intelligence confirms active exploitation.',
        provider: 'rss',
        publishedAt: '2026-06-13T11:00:00Z',
      },
      { now, sourcePriority: 95 },
    );
    const generic = scoreIntelligenceItem(
      {
        title: 'General business update',
        summary: 'Quarterly update.',
        provider: 'rss',
        publishedAt: '2025-01-01T00:00:00Z',
      },
      { now, sourcePriority: 20 },
    );
    expect(important).toBeGreaterThan(generic);
    expect(important).toBeGreaterThanOrEqual(75);
  });

  it('extracts public indicators and repository references', () => {
    const entities = extractEntities(
      'Contact analyst@example.com about CVE-2026-4444 at 8.8.8.8 and https://github.com/org/tool.',
    );
    expect(entities.emails).toContain('analyst@example.com');
    expect(entities.ipAddresses).toContain('8.8.8.8');
    expect(entities.githubRepos).toContain('org/tool');
    expect(entities.domains).toContain('github.com');
  });
});

describe('deduplication and watchlists', () => {
  it('detects exact and highly similar titles', () => {
    const candidate = { title: 'Critical Firebase vulnerability disclosed today', url: '', hash: 'one' };
    const existing = [{ title: 'Critical Firebase vulnerability disclosed', url: '', hash: 'two' }];
    expect(titleSimilarity(candidate.title, existing[0].title)).toBeGreaterThan(0.7);
    expect(isDuplicate({ ...candidate, hash: 'two' }, existing)).toBe(true);
  });

  it('matches enabled watchlists and ignores disabled ones', () => {
    const item = { title: 'New Cloud Run CVE', summary: 'Firebase exposure', score: 88, tags: [] };
    const watchlist = {
      enabled: true,
      keywords: ['CVE', 'ransomware'],
      entities: ['Firebase'],
    };
    expect(matchWatchlist(item, watchlist)?.matchedKeywords).toEqual(['cve', 'firebase']);
    expect(matchWatchlist(item, { ...watchlist, enabled: false })).toBeNull();
  });

  it('extracts actionable ideas from repository metadata', () => {
    const ideas = extractRepositoryIdeas({
      name: 'threat-dashboard',
      description: 'MISP CVE threat intelligence dashboard with Telegram bot',
      topics: ['osint'],
    });
    expect(ideas.length).toBeGreaterThanOrEqual(3);
  });
});
