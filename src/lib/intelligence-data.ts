import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { cleanText, safeHttpUrl } from './validation';
import type {
  IntelligenceAlert,
  ArabicIntelligenceReport,
  GreyIntelligenceItem,
  IntelligenceNewsItem,
  IntelligenceProvider,
  IntelligenceReport,
  IntelligenceSource,
  IntelligenceTask,
  NewsFetchLog,
  RepositoryIntelligenceItem,
  Role,
  Watchlist,
  WatchlistHit,
} from '../types';

type SnapshotLike = { docs: Array<{ id: string; data(): DocumentData }> };

function mapSnapshot<T>(snapshot: SnapshotLike): Array<T & { id: string }> {
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as T) }));
}

function timestampMillis(value: unknown): number {
  const timestamp = value as { toMillis?: () => number };
  if (typeof timestamp?.toMillis === 'function') return timestamp.toMillis();
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function subscribeCollection<T>(
  collectionName: string,
  sortField: string,
  maximum: number,
  success: (items: T[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, collectionName), orderBy(sortField, 'desc'), limit(maximum)),
    (snapshot) => success(mapSnapshot<Omit<T, 'id'>>(snapshot) as T[]),
    failure,
  );
}

async function writeAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
): Promise<void> {
  await addDoc(collection(db, 'audit_logs'), {
    actorId,
    action,
    targetType,
    targetId,
    createdAt: serverTimestamp(),
  });
}

export function subscribeIntelligenceNews(
  success: (items: IntelligenceNewsItem[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return subscribeCollection('news_items', 'publishedAt', 300, success, failure);
}

export function subscribeGreyIntelligence(
  success: (items: GreyIntelligenceItem[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return subscribeCollection('grey_intel_items', 'publishedAt', 500, success, failure);
}

export function subscribeIntelligenceReports(
  userId: string,
  role: Role,
  success: (items: ArabicIntelligenceReport[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  const reportsQuery = role === 'user'
    ? query(collection(db, 'intelligence_reports'), where('createdBy', '==', userId), limit(200))
    : query(collection(db, 'intelligence_reports'), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    reportsQuery,
    (snapshot) => {
      const items = mapSnapshot<Omit<ArabicIntelligenceReport, 'id'>>(
        snapshot,
      ) as ArabicIntelligenceReport[];
      items.sort((left, right) =>
        timestampMillis(right.createdAt) - timestampMillis(left.createdAt));
      success(items);
    },
    failure,
  );
}

export function subscribeIntelligenceSources(
  success: (items: IntelligenceSource[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'news_sources'), orderBy('name'), limit(500)),
    (snapshot) =>
      success(mapSnapshot<Omit<IntelligenceSource, 'id'>>(snapshot) as IntelligenceSource[]),
    failure,
  );
}

export function subscribeRepositories(
  success: (items: RepositoryIntelligenceItem[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return subscribeCollection('repo_intelligence_items', 'score', 300, success, failure);
}

export function subscribeWatchlists(
  userId: string,
  role: Role,
  success: (items: Watchlist[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  const watchlistQuery = role === 'user'
    ? query(
        collection(db, 'watchlists'),
        where('createdBy', '==', userId),
        limit(200),
      )
    : query(collection(db, 'watchlists'), orderBy('updatedAt', 'desc'), limit(200));
  return onSnapshot(
    watchlistQuery,
    (snapshot) => {
      const items = mapSnapshot<Omit<Watchlist, 'id'>>(snapshot) as Watchlist[];
      items.sort((left, right) =>
        timestampMillis(right.updatedAt) - timestampMillis(left.updatedAt));
      success(items);
    },
    failure,
  );
}

export function subscribeWatchlistHits(
  success: (items: WatchlistHit[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return subscribeCollection('watchlist_hits', 'createdAt', 300, success, failure);
}

export function subscribeAlerts(
  success: (items: IntelligenceAlert[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return subscribeCollection('alerts', 'createdAt', 200, success, failure);
}

export function subscribeFetchLogs(
  success: (items: NewsFetchLog[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return subscribeCollection('news_fetch_logs', 'startedAt', 100, success, failure);
}

export function subscribeBookmarks(
  userId: string,
  success: (ids: Set<string>) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'news_bookmarks'), where('userId', '==', userId), limit(500)),
    (snapshot) => success(new Set(snapshot.docs.map((item) => String(item.data().newsId)))),
    failure,
  );
}

export async function saveIntelligenceSource(
  id: string | null,
  input: {
    name: string;
    provider: IntelligenceProvider;
    url: string;
    query: string;
    category: string;
    language: string;
    priority: number;
    enabled: boolean;
    fetchIntervalMinutes: number;
    createdBy: string;
  },
): Promise<void> {
  const payload = {
    name: cleanText(input.name, 160),
    type: input.provider,
    provider: input.provider,
    url: safeHttpUrl(input.url),
    query: cleanText(input.query, 300),
    category: cleanText(input.category, 100),
    language: cleanText(input.language, 12).toLowerCase(),
    priority: Math.max(0, Math.min(100, Math.round(input.priority))),
    enabled: input.enabled,
    fetchIntervalMinutes: Math.max(15, Math.min(1440, Math.round(input.fetchIntervalMinutes))),
    updatedAt: serverTimestamp(),
    createdBy: input.createdBy,
  };
  if (id) {
    await updateDoc(doc(db, 'news_sources', id), payload);
    await writeAudit(input.createdBy, 'source.update', 'news_source', id);
    return;
  }
  const created = await addDoc(collection(db, 'news_sources'), {
    ...payload,
    lastFetchedAt: null,
    lastError: '',
    createdAt: serverTimestamp(),
  });
  await writeAudit(input.createdBy, 'source.create', 'news_source', created.id);
}

export async function deleteIntelligenceSource(id: string, actorId: string): Promise<void> {
  await deleteDoc(doc(db, 'news_sources', id));
  await writeAudit(actorId, 'source.delete', 'news_source', id);
}

export async function toggleNewsBookmark(newsId: string, userId: string, save: boolean): Promise<void> {
  const bookmarkRef = doc(db, 'news_bookmarks', `${userId}_${newsId}`);
  if (!save) {
    await deleteDoc(bookmarkRef);
    return;
  }
  await setDoc(bookmarkRef, { newsId, userId, createdAt: serverTimestamp() });
}

export async function summarizeNewsItem(item: IntelligenceNewsItem): Promise<void> {
  const summary = cleanText(item.summary_ar || item.summary || item.contentSnippet_ar || item.contentSnippet, 900);
  if (!summary) throw new Error('لا يوجد محتوى كافٍ لإنشاء ملخص.');
  const sentences = summary.split(/(?<=[.!؟])\s+/).filter(Boolean).slice(0, 3);
  await updateDoc(doc(db, 'news_items', item.id), {
    summary: sentences.join(' '),
    summary_ar: sentences.join(' '),
    updatedAt: serverTimestamp(),
  });
}

export async function toggleGreyBookmark(itemId: string, userId: string, save: boolean): Promise<void> {
  const bookmarkRef = doc(db, 'grey_bookmarks', `${userId}_${itemId}`);
  if (!save) {
    await deleteDoc(bookmarkRef);
    return;
  }
  await setDoc(bookmarkRef, { itemId, userId, createdAt: serverTimestamp() });
}

export async function createTaskFromItem(
  input: Pick<IntelligenceTask, 'title' | 'description' | 'sourceType' | 'sourceIds' | 'createdBy'>,
): Promise<void> {
  await addDoc(collection(db, 'tasks'), {
    title: cleanText(input.title, 220),
    description: cleanText(input.description, 3000),
    status: 'open',
    sourceType: input.sourceType,
    sourceIds: input.sourceIds.slice(0, 100),
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createReportFromNews(
  input: Pick<IntelligenceReport, 'title' | 'format' | 'newsIds' | 'repositoryIds' | 'content' | 'createdBy'>,
): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    title: cleanText(input.title, 220),
    format: input.format,
    status: 'draft',
    newsIds: input.newsIds.slice(0, 100),
    repositoryIds: input.repositoryIds.slice(0, 100),
    content: cleanText(input.content, 50_000),
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createArabicIntelligenceReport(
  input: Omit<ArabicIntelligenceReport, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  await addDoc(collection(db, 'intelligence_reports'), {
    type: input.type,
    title: cleanText(input.title, 220),
    coverage: cleanText(input.coverage, 1000),
    executiveSummary: cleanText(input.executiveSummary, 5000),
    content: cleanText(input.content, 50_000),
    newsIds: input.newsIds.slice(0, 200),
    greyIntelIds: input.greyIntelIds.slice(0, 200),
    repositoryIds: input.repositoryIds.slice(0, 200),
    riskLevel: input.riskLevel,
    legalNotice: cleanText(input.legalNotice, 1000),
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function saveRepository(id: string, saved: boolean): Promise<void> {
  await updateDoc(doc(db, 'repo_intelligence_items', id), {
    saved,
    updatedAt: serverTimestamp(),
  });
}

export async function saveWatchlist(
  id: string | null,
  input: Pick<Watchlist, 'name' | 'type' | 'keywords' | 'entities' | 'enabled' | 'notifyChannels' | 'createdBy'>,
): Promise<void> {
  const payload = {
    name: cleanText(input.name, 160),
    type: input.type,
    keywords: input.keywords.map((value) => cleanText(value, 120)).filter(Boolean).slice(0, 100),
    entities: input.entities.map((value) => cleanText(value, 120)).filter(Boolean).slice(0, 100),
    enabled: input.enabled,
    notifyChannels: input.notifyChannels,
    createdBy: input.createdBy,
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, 'watchlists', id), payload);
    return;
  }
  await addDoc(collection(db, 'watchlists'), { ...payload, createdAt: serverTimestamp() });
}

export async function deleteWatchlist(id: string): Promise<void> {
  await deleteDoc(doc(db, 'watchlists', id));
}

export async function markAlertRead(id: string, read = true): Promise<void> {
  await updateDoc(doc(db, 'alerts', id), { read });
}

export async function markAllAlertsRead(alerts: IntelligenceAlert[]): Promise<void> {
  await Promise.all(alerts.filter((alert) => !alert.read).map((alert) => markAlertRead(alert.id)));
}

export async function requestIntelligenceRefresh(
  requestedBy: string,
  provider = '',
  scope: 'all' | 'arabic' | 'grey' = 'all',
  type: 'refresh' | 'seed-arabic' | 'seed-grey' = 'refresh',
): Promise<void> {
  await addDoc(collection(db, 'intelligence_requests'), {
    type,
    provider: cleanText(provider, 40),
    scope,
    requestedBy,
    status: 'pending',
    requestedAt: serverTimestamp(),
  });
}
