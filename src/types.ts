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

export type IntelligenceProvider = 'rss' | 'gdelt' | 'hackernews' | 'github' | 'newsapi' | 'cisa_kev' | 'custom';
export type IntelligenceStatus = 'active' | 'archived' | 'review';
export type AlertSeverity = 'info' | 'warning' | 'high' | 'critical';
export type ArabicRiskLevel = 'منخفض' | 'متوسط' | 'مرتفع' | 'حرج';
export type ArabicImportance = 'منخفضة' | 'متوسطة' | 'عالية' | 'عاجلة';
export type DataSensitivity = 'عام' | 'حساس' | 'مؤشر تسريب' | 'تسريب محتمل' | 'محظور التخزين';
export type IntelligenceSourceType =
  | 'official_news'
  | 'official_advisory'
  | 'public_news'
  | 'public_blog'
  | 'public_research'
  | 'rss'
  | 'gdelt_query'
  | 'github_advisory'
  | 'github_repository'
  | 'manual'
  | 'grey_metadata_only'
  | 'security_vendor'
  | 'government_agency'
  | 'regional_media'
  | 'international_media';

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
  source_type?: IntelligenceSourceType;
  category: string;
  subcategory?: string;
  country?: string;
  region?: string;
  language: string;
  summary: string;
  summary_ar?: string;
  contentSnippet: string;
  contentSnippet_ar?: string;
  author: string;
  imageUrl: string;
  publishedAt: Timestamp | Date;
  fetchedAt: Timestamp | Date;
  tags: string[];
  tags_ar?: string[];
  entities: IntelligenceEntities;
  score: number;
  base_score?: number;
  importance?: ArabicImportance;
  risk_level?: ArabicRiskLevel;
  sentiment?: 'سلبي' | 'محايد' | 'إيجابي' | 'مختلط';
  confidence?: number;
  relevance_score?: number;
  hash: string;
  rawPayload?: Record<string, unknown>;
  rawPayloadMetadataOnly?: Record<string, unknown>;
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
  source_type?: IntelligenceSourceType;
  category: string;
  language: string;
  priority: number;
  reliability_score?: number;
  enabled: boolean;
  fetchIntervalMinutes: number;
  query?: string;
  category_mode?: 'infer' | 'fixed';
  intelligence_scope?: 'arabic' | 'grey';
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
  type:
    | 'mixed'
    | 'news'
    | 'repository'
    | 'دولة'
    | 'شركة'
    | 'جهة حكومية'
    | 'شخص'
    | 'دومين'
    | 'بريد'
    | 'CVE'
    | 'جماعة/فصيل'
    | 'كلمة مفتاحية'
    | 'مستودع GitHub'
    | 'مصدر إخباري';
  keywords: string[];
  entities: string[];
  countries?: string[];
  categories?: string[];
  enabled: boolean;
  notifyChannels: Array<'dashboard' | 'email' | 'telegram'>;
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface WatchlistHit {
  id: string;
  watchlistId: string;
  itemType: 'news' | 'grey' | 'repository';
  itemId: string;
  matchedText: string;
  matchedKeywords: string[];
  score: number;
  createdAt: Timestamp | Date;
}

export interface IntelligenceAlert {
  id: string;
  type: 'high-score' | 'watchlist-hit' | 'repository-match' | 'cve' | 'leak-indicator' | 'fetch-failure';
  title: string;
  message: string;
  severity: AlertSeverity;
  itemType: 'news' | 'grey' | 'repository' | 'source';
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

export interface GreyIntelligenceItem {
  id: string;
  title: string;
  url: string;
  source: string;
  provider: IntelligenceProvider;
  source_type: IntelligenceSourceType;
  language: string;
  country: string;
  region: string;
  category: string;
  subcategory: string;
  summary_ar: string;
  contentSnippet_ar: string;
  affected_entities: string[];
  leaked_data_type: string;
  data_sensitivity: DataSensitivity;
  risk_level: ArabicRiskLevel;
  importance: ArabicImportance;
  confidence: number;
  tags_ar: string[];
  entities: IntelligenceEntities;
  publishedAt: Timestamp | Date;
  fetchedAt: Timestamp | Date;
  hash: string;
  rawPayloadMetadataOnly: Record<string, unknown>;
  legal_warning: string;
  status: IntelligenceStatus;
  bookmarked?: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface ArabicIntelligenceReport {
  id: string;
  type:
    | 'موجز استخباري إقليمي'
    | 'تقرير التسريبات والمصادر الرمادية'
    | 'تقرير الخليج وإيران'
    | 'تقرير التجسس والاستخبارات'
    | 'تقرير الضربات والهجمات'
    | 'تقرير المستودعات والأدوات الجديدة'
    | 'تقرير مراقبة قائمة محددة'
    | 'تقرير أسبوعي تنفيذي';
  title: string;
  coverage: string;
  executiveSummary: string;
  content: string;
  newsIds: string[];
  greyIntelIds: string[];
  repositoryIds: string[];
  riskLevel: ArabicRiskLevel;
  legalNotice: string;
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}
