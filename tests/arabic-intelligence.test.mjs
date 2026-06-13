import { describe, expect, it } from 'vitest';
import {
  ARABIC_CATEGORIES,
  LEGAL_NOTICE,
  buildArabicExecutiveReport,
  classifyArabicCategory,
  extractArabicEntities,
  scoreArabicRisk,
  toArabicIntelligenceItem,
  toGreyMetadataItem,
} from '../scripts/arabic-intelligence-lib.mjs';
import {
  ARABIC_GDELT_QUERIES,
  ARABIC_RSS_SOURCES,
  buildArabicSeedSources,
  buildGreySeedSources,
} from '../scripts/arabic-intelligence-sources.mjs';

const baseItem = {
  id: 'item-1',
  title: 'هجوم سيبراني وتسريب بيانات في السعودية',
  url: 'https://example.com/public-report',
  source: 'مصدر عام',
  provider: 'rss',
  language: 'ar',
  summary: 'أعلنت جهة عامة عن خرق بيانات دون نشر سجلات شخصية.',
  contentSnippet: 'مؤشر منشور يحتاج إلى تحقق إضافي.',
  publishedAt: '2026-06-13T00:00:00Z',
  fetchedAt: '2026-06-13T01:00:00Z',
  tags: [],
  entities: {
    people: [],
    organizations: [],
    countries: [],
    domains: [],
    urls: [],
    emails: [],
    ipAddresses: [],
    cves: [],
    githubRepos: [],
    technologies: [],
    cloudProducts: [],
  },
  score: 55,
  hash: 'hash',
  rawPayload: { body: 'must never be copied to grey metadata' },
  status: 'active',
};

describe('Arabic intelligence normalization', () => {
  it('keeps the requested analytical category list', () => {
    expect(ARABIC_CATEGORIES).toHaveLength(50);
    expect(ARABIC_CATEGORIES).toContain('الملف الشيعي السياسي');
    expect(ARABIC_CATEGORIES).not.toContain('الشيعة');
  });

  it('classifies Arabic security and regional text', () => {
    expect(classifyArabicCategory('رصد هجوم سيبراني وثغرة CVE جديدة')).toBe('الأمن السيبراني');
    expect(classifyArabicCategory('تطورات الحرس الثوري وفيلق القدس في طهران')).toBe('إيران');
  });

  it('extracts Arabic countries, organizations, places, and security terms', () => {
    const entities = extractArabicEntities('رصد الحرس الثوري هجومًا قرب مضيق هرمز بين إيران والسعودية');
    expect(entities.countries).toEqual(expect.arrayContaining(['إيران', 'السعودية']));
    expect(entities.organizations).toContain('الحرس الثوري');
    expect(entities.places).toContain('مضيق هرمز');
    expect(entities.securityTerms).toContain('هجوم');
  });

  it('normalizes Arabic fields and calculates risk', () => {
    const item = toArabicIntelligenceItem(baseItem, {
      category: 'الأمن السيبراني',
      source_type: 'public_news',
      reliability_score: 90,
    });
    expect(item.summary_ar).toContain('خرق بيانات');
    expect(item.country).toBe('السعودية');
    expect(item.tags_ar).toContain('الأمن السيبراني');
    expect(item.confidence).toBe(90);
  });

  it('raises direct strike and intelligence leak risk', () => {
    const risk = scoreArabicRisk({
      title: 'قصف وتسريب استخباراتي في الخليج وإيران',
      summary: 'استهداف سفن في مضيق هرمز',
      score: 50,
    });
    expect(risk.risk_level).toBe('حرج');
    expect(risk.importance).toBe('عاجلة');
  });
});

describe('Grey intelligence safety', () => {
  it('stores metadata only and removes content when storage is forbidden', () => {
    const item = toGreyMetadataItem(baseItem, {
      category: 'المصادر الرمادية',
      source_type: 'grey_metadata_only',
      data_sensitivity: 'محظور التخزين',
    });
    expect(item.contentSnippet_ar).toBe('');
    expect(item.tags_ar).toContain('مؤشرات فقط');
    expect(item.legal_warning).toBe(LEGAL_NOTICE);
    expect(item.rawPayloadMetadataOnly).not.toHaveProperty('body');
    expect(JSON.stringify(item)).not.toContain('must never be copied');
  });
});

describe('Arabic source seeds and reports', () => {
  it('seeds all Arabic GDELT queries and regional sources', () => {
    const sources = buildArabicSeedSources();
    expect(ARABIC_GDELT_QUERIES).toHaveLength(10);
    expect(ARABIC_RSS_SOURCES).toHaveLength(4);
    expect(sources.length).toBeGreaterThan(35);
    expect(sources.every((source) => source.language === 'ar')).toBe(true);
    expect(sources.some((source) => source.name.includes('واس'))).toBe(true);
    expect(sources.some((source) => source.provider === 'rss')).toBe(true);
  });

  it('seeds only public security metadata sources', () => {
    const sources = buildGreySeedSources();
    expect(sources.some((source) => source.provider === 'cisa_kev')).toBe(true);
    expect(sources.every((source) => source.intelligence_scope === 'grey')).toBe(true);
    expect(sources.every((source) => /^https:\/\//.test(source.url))).toBe(true);
  });

  it('generates an Arabic executive report with the legal notice', () => {
    const item = toArabicIntelligenceItem(baseItem, { category: 'الأمن السيبراني' });
    const report = buildArabicExecutiveReport({
      type: 'موجز استخباري إقليمي',
      title: 'موجز الاختبار',
      items: [item],
    });
    expect(report.content).toContain('الملخص التنفيذي');
    expect(report.content).toContain('التوصيات التنفيذية');
    expect(report.content).toContain(LEGAL_NOTICE);
  });
});
