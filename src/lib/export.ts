import type { NewsItem, Source } from '../types';

function exportDate(value: unknown): string {
  const maybeTimestamp = value as { toDate?: () => Date };
  const date =
    typeof maybeTimestamp?.toDate === 'function'
      ? maybeTimestamp.toDate()
      : new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function buildExportPayload(news: NewsItem[], sources: Source[]) {
  return {
    schemaVersion: 1,
    news: news.map((item) => ({
      title: item.title,
      source: item.sourceName,
      url: item.url,
      category: item.category,
      importance: item.importance,
      notes: item.summary,
      timestamp: exportDate(item.publishedAt),
    })),
    sources: sources.map((item) => ({
      name: item.name,
      feedUrl: item.feedUrl,
      siteUrl: item.siteUrl,
      category: item.category,
      status: item.status,
    })),
    exportedAt: new Date().toISOString(),
  };
}
