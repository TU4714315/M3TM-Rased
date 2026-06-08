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
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { normalizeEmail } from './permissions';
import { cleanText, safeHttpUrl } from './validation';
import type {
  Importance,
  Invite,
  NewsItem,
  Role,
  Source,
  SyncRun,
  UserProfile,
  AppSettings,
} from '../types';

type WithId<T> = T & { id: string };

function mapSnapshot<T>(snapshot: { docs: Array<{ id: string; data(): DocumentData }> }): WithId<T>[] {
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as T) }));
}

export function subscribeNews(
  success: (items: NewsItem[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'news'), orderBy('publishedAt', 'desc'), limit(500)),
    (snapshot) => success(mapSnapshot<Omit<NewsItem, 'id'>>(snapshot)),
    failure,
  );
}

export function subscribeSources(
  success: (items: Source[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'sources'), orderBy('name'), limit(500)),
    (snapshot) => success(mapSnapshot<Omit<Source, 'id'>>(snapshot)),
    failure,
  );
}

export function subscribeUsers(
  success: (items: UserProfile[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'users'), orderBy('email'), limit(500)),
    (snapshot) => success(mapSnapshot<Omit<UserProfile, 'id'>>(snapshot)),
    failure,
  );
}

export function subscribeInvites(
  success: (items: Invite[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'invites'), orderBy('createdAt', 'desc'), limit(500)),
    (snapshot) => success(mapSnapshot<Omit<Invite, 'id'>>(snapshot)),
    failure,
  );
}

export function subscribeSyncRuns(
  success: (items: SyncRun[]) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'syncRuns'), orderBy('startedAt', 'desc'), limit(30)),
    (snapshot) => success(mapSnapshot<Omit<SyncRun, 'id'>>(snapshot)),
    failure,
  );
}

export function subscribeSettings(
  success: (settings: AppSettings | null) => void,
  failure: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'settings', 'general'),
    (snapshot) =>
      success(
        snapshot.exists()
          ? ({ id: 'general', ...(snapshot.data() as Omit<AppSettings, 'id'>) } as AppSettings)
          : null,
      ),
    failure,
  );
}

export async function createNews(
  input: Omit<NewsItem, 'id' | 'createdAt' | 'publishedAt' | 'fingerprint'>,
): Promise<void> {
  await addDoc(collection(db, 'news'), {
    ...input,
    title: cleanText(input.title, 180),
    sourceName: cleanText(input.sourceName, 120),
    url: input.url ? safeHttpUrl(input.url) : '',
    category: cleanText(input.category, 80),
    summary: cleanText(input.summary, 2000),
    fingerprint: crypto.randomUUID(),
    publishedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

export async function deleteNews(id: string): Promise<void> {
  await deleteDoc(doc(db, 'news', id));
}

export async function saveSource(
  id: string | null,
  input: Pick<Source, 'name' | 'feedUrl' | 'siteUrl' | 'category' | 'status' | 'createdBy'>,
): Promise<void> {
  const payload = {
    name: cleanText(input.name, 140),
    feedUrl: safeHttpUrl(input.feedUrl),
    siteUrl: input.siteUrl ? safeHttpUrl(input.siteUrl) : '',
    category: cleanText(input.category, 80),
    status: input.status,
    updatedAt: serverTimestamp(),
    createdBy: input.createdBy,
  };
  if (id) {
    await updateDoc(doc(db, 'sources', id), payload);
    return;
  }
  await addDoc(collection(db, 'sources'), {
    ...payload,
    createdAt: serverTimestamp(),
    lastSyncAt: null,
    lastError: '',
  });
}

export async function deleteSource(id: string): Promise<void> {
  await deleteDoc(doc(db, 'sources', id));
}

export async function createInvite(email: string, role: Role, createdBy: string): Promise<void> {
  const normalized = normalizeEmail(email);
  await setDoc(doc(db, 'invites', normalized), {
    email: normalized,
    role,
    status: 'pending',
    createdBy,
    createdAt: serverTimestamp(),
    acceptedAt: null,
  });
}

export async function revokeInvite(email: string): Promise<void> {
  await updateDoc(doc(db, 'invites', normalizeEmail(email)), { status: 'revoked' });
}

export async function updateUserAccess(id: string, role: Role, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', id), { role, active, updatedAt: serverTimestamp() });
}

export async function saveSettings(
  input: Pick<AppSettings, 'platformName' | 'defaultCategory' | 'feedSyncEnabled' | 'updatedBy'>,
): Promise<void> {
  await setDoc(
    doc(db, 'settings', 'general'),
    {
      platformName: cleanText(input.platformName, 80),
      defaultCategory: cleanText(input.defaultCategory, 80),
      feedSyncEnabled: input.feedSyncEnabled,
      updatedAt: serverTimestamp(),
      updatedBy: input.updatedBy,
    },
    { merge: true },
  );
}

export async function requestSync(requestedBy: string): Promise<void> {
  await addDoc(collection(db, 'syncRequests'), {
    requestedBy,
    status: 'pending',
    requestedAt: serverTimestamp(),
  });
}

export const importanceLabels: Record<Importance, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالٍ',
  critical: 'حرج',
};
