import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'manager' | 'user';
export type SourceStatus = 'active' | 'paused' | 'error';
export type Importance = 'low' | 'medium' | 'high' | 'critical';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
  createdBy: string;
  createdAt: Timestamp | Date;
  acceptedAt?: Timestamp | Date | null;
}

export interface NewsItem {
  id: string;
  title: string;
  sourceId?: string;
  sourceName: string;
  url: string;
  category: string;
  importance: Importance;
  summary: string;
  fingerprint: string;
  publishedAt: Timestamp | Date;
  createdAt: Timestamp | Date;
  createdBy: string;
}

export interface Source {
  id: string;
  name: string;
  feedUrl: string;
  siteUrl: string;
  category: string;
  status: SourceStatus;
  lastSyncAt?: Timestamp | Date | null;
  lastError?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string;
}

export interface SyncRun {
  id: string;
  sourceId: string;
  sourceName: string;
  status: 'success' | 'partial' | 'failed';
  fetched: number;
  inserted: number;
  skipped: number;
  error?: string;
  startedAt: Timestamp | Date;
  finishedAt: Timestamp | Date;
}

export interface AppSettings {
  id: 'general';
  platformName: string;
  defaultCategory: string;
  feedSyncEnabled: boolean;
  updatedAt: Timestamp | Date;
  updatedBy: string;
}

export interface LegacyExport {
  news?: unknown[];
  sources?: unknown[];
  exportedAt?: string;
}
