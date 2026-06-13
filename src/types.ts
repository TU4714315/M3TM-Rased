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

export type IntelligenceProvider = 'rss' | 'gdelt' | 'hackernews' | 'github' | 'newsapi' | 'custom';
export type IntelligenceStatus = 'active' | 'archived' | 'review';
export type AlertSeverity = 'info' | 'warning' | 'high' | 'critical';

export interface IntelligenceEntities {
  people: string[];
  organizations: string[];
  countries: string[];
  domains: string[];
  urls: string[];
  emails: string[];
  ipAddresses: string[];
  cves: string[];
  githubRepos: string[];
  technologies: string[];
  cloudProducts: string[];
}

export interface IntelligenceNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceId?: string;
  provider: IntelligenceProvider;
  category: string;
  language: string;
  summary: string;
  contentSnippet: string;
  author: string;
  imageUrl: string;
  publishedAt: Timestamp | Date;
  fetchedAt: Timestamp | Date;
  tags: string[];
  entities: IntelligenceEntities;
  score: number;
  hash: string;
  rawPayload?: Record<string, unknown>;
  status: IntelligenceStatus;
  bookmarked?: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface IntelligenceSource {
  id: string;
  name: string;
  type: IntelligenceProvider;
  url: string;
  provider: IntelligenceProvider;
  category: string;
  language: string;
  priority: number;
  enabled: boolean;
  fetchIntervalMinutes: number;
  query?: string;
  lastFetchedAt?: Timestamp | Date | null;
  lastError?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string;
}

export interface NewsFetchLog {
  id: string;
  sourceId: string;
  provider: IntelligenceProvider;
  status: 'success' | 'partial' | 'failed';
  fetchedCount: number;
  insertedCount: number;
  duplicateCount: number;
  errorMessage: string;
  startedAt: Timestamp | Date;
  finishedAt: Timestamp | Date;
}

export interface RepositoryIntelligenceItem {
  id: string;
  repoName: string;
  fullName: string;
  url: string;
  description: string;
  owner: string;
  language: string;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  lastCommitAt: Timestamp | Date;
  license: string;
  score: number;
  tags: string[];
  usefulIdeas: string[];
  implementationPriority: 'low' | 'medium' | 'high';
  saved: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Watchlist {
  id: string;
  name: string;
  type: 'mixed' | 'news' | 'repository';
  keywords: string[];
  entities: string[];
  enabled: boolean;
  notifyChannels: Array<'dashboard' | 'email' | 'telegram'>;
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface WatchlistHit {
  id: string;
  watchlistId: string;
  itemType: 'news' | 'repository';
  itemId: string;
  matchedText: string;
  matchedKeywords: string[];
  score: number;
  createdAt: Timestamp | Date;
}

export interface IntelligenceAlert {
  id: string;
  type: 'high-score' | 'watchlist-hit' | 'repository-match' | 'cve' | 'fetch-failure';
  title: string;
  message: string;
  severity: AlertSeverity;
  itemType: 'news' | 'repository' | 'source';
  itemId: string;
  read: boolean;
  userId?: string;
  createdAt: Timestamp | Date;
}

export interface IntelligenceTask {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'done';
  sourceType: 'news' | 'repository';
  sourceIds: string[];
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface IntelligenceReport {
  id: string;
  title: string;
  format: 'json' | 'markdown' | 'html';
  status: 'draft' | 'ready';
  newsIds: string[];
  repositoryIds: string[];
  content: string;
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}
