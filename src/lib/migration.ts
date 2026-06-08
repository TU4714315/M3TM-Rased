import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { cleanText, fingerprint, safeHttpUrl } from './validation';
import type { Importance, LegacyExport } from '../types';

export interface ImportPreview {
  validNews: number;
  invalidNews: number;
  validSources: number;
  invalidSources: number;
  payload: LegacyExport;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseDate(value: unknown): Date {
  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseImportance(value: unknown): Importance {
  const text = cleanText(value).toLowerCase();
  if (text.includes('حرج') || text.includes('critical')) return 'critical';
  if (text.includes('عال') || text.includes('high')) return 'high';
  if (text.includes('متوسط') || text.includes('medium')) return 'medium';
  return 'low';
}

export function previewLegacyImport(json: string): ImportPreview {
  const parsed = JSON.parse(json) as LegacyExport;
  const news = Array.isArray(parsed.news) ? parsed.news : [];
  const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
  const validNews = news.filter((item) => {
    const record = asRecord(item);
    return Boolean(record && cleanText(record.title) && cleanText(record.source));
  }).length;
  const validSources = sources.filter((item) => {
    const record = asRecord(item);
    if (!record || !cleanText(record.name)) return false;
    try {
      safeHttpUrl(String(record.feedUrl ?? record.url ?? ''));
      return true;
    } catch {
      return false;
    }
  }).length;
  return {
    validNews,
    invalidNews: news.length - validNews,
    validSources,
    invalidSources: sources.length - validSources,
    payload: parsed,
  };
}

export async function importLegacyData(
  preview: ImportPreview,
  userId: string,
): Promise<{ news: number; sources: number }> {
  const news = Array.isArray(preview.payload.news) ? preview.payload.news : [];
  const sources = Array.isArray(preview.payload.sources) ? preview.payload.sources : [];
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  let newsCount = 0;
  let sourceCount = 0;

  for (const item of news) {
    const record = asRecord(item);
    if (!record) continue;
    const title = cleanText(record.title, 180);
    const sourceName = cleanText(record.source ?? record.sourceName, 120);
    if (!title || !sourceName) continue;
    let url = '';
    try {
      url = record.url ? safeHttpUrl(String(record.url)) : '';
    } catch {
      url = '';
    }
    const id = await fingerprint([title, url, sourceName]);
    operations.push((batch) =>
      batch.set(
        doc(db, 'news', id),
        {
          title,
          sourceName,
          sourceId: '',
          url,
          category: cleanText(record.category || 'عام', 80),
          importance: parseImportance(record.importance),
          summary: cleanText(record.notes ?? record.summary, 2000),
          fingerprint: id,
          publishedAt: parseDate(record.timestamp ?? record.date),
          createdAt: serverTimestamp(),
          createdBy: userId,
        },
        { merge: true },
      ),
    );
    newsCount += 1;
  }

  for (const item of sources) {
    const record = asRecord(item);
    if (!record) continue;
    const name = cleanText(record.name, 140);
    let feedUrl = '';
    try {
      feedUrl = safeHttpUrl(String(record.feedUrl ?? record.url ?? ''));
    } catch {
      continue;
    }
    const id = await fingerprint([feedUrl]);
    operations.push((batch) =>
      batch.set(
        doc(db, 'sources', id),
        {
          name,
          feedUrl,
          siteUrl: '',
          category: cleanText(record.category || 'عام', 80),
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userId,
          lastSyncAt: null,
          lastError: '',
        },
        { merge: true },
      ),
    );
    sourceCount += 1;
  }

  for (let index = 0; index < operations.length; index += 400) {
    const batch = writeBatch(db);
    operations.slice(index, index + 400).forEach((operation) => operation(batch));
    await batch.commit();
  }
  return { news: newsCount, sources: sourceCount };
}
