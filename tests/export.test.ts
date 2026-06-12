import { describe, expect, it } from 'vitest';
import { buildExportPayload } from '../src/lib/export';
import type { NewsItem, Source } from '../src/types';

describe('data export', () => {
  it('creates an import-compatible JSON payload without internal ids', () => {
    const news = [
      {
        id: 'private-id',
        title: 'خبر',
        sourceName: 'المصدر',
        sourceId: 'source-id',
        url: 'https://example.com/news',
        category: 'عام',
        importance: 'high',
        summary: 'ملخص',
        fingerprint: 'fingerprint',
        publishedAt: new Date('2026-06-07T10:00:00Z'),
        createdAt: new Date(),
        createdBy: 'user-id',
      },
    ] satisfies NewsItem[];
    const sources = [
      {
        id: 'source-id',
        name: 'المصدر',
        feedUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com',
        category: 'عام',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-id',
      },
    ] satisfies Source[];

    const result = buildExportPayload(news, sources);
    expect(result.schemaVersion).toBe(1);
    expect(result.news[0]).toEqual({
      title: 'خبر',
      source: 'المصدر',
      url: 'https://example.com/news',
      category: 'عام',
      importance: 'high',
      notes: 'ملخص',
      timestamp: '2026-06-07T10:00:00.000Z',
    });
    expect(result.sources[0]).not.toHaveProperty('id');
  });
});
