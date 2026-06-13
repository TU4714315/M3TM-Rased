import admin from 'firebase-admin';
import { pathToFileURL } from 'node:url';
import { assertPublicUrl } from './feed-lib.mjs';
import {
  extractRepositoryIdeas,
  intelligenceHash,
  matchWatchlist,
  normalizeNewsItem,
} from './intelligence-lib.mjs';
import {
  toArabicIntelligenceItem,
  toGreyMetadataItem,
} from './arabic-intelligence-lib.mjs';
import {
  buildArabicSeedSources,
  buildGreySeedSources,
} from './arabic-intelligence-sources.mjs';
import {
  DEFAULT_GDELT_QUERIES,
  DEFAULT_GITHUB_QUERIES,
  DEFAULT_INTELLIGENCE_SOURCES,
} from './intelligence-sources.mjs';
import { fetchProvider } from './provider-client.mjs';

const serviceAccountValue = process.env.FIREBASE_SERVICE_ACCOUNT_M3TM_RASED;
if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccountValue
      ? admin.credential.cert(JSON.parse(serviceAccountValue))
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  });
}
const db = admin.firestore();
const maxItems = Math.max(1, Math.min(100, Number(process.env.NEWS_MAX_ITEMS_PER_FETCH || 100)));

function timestamp(date) {
  return admin.firestore.Timestamp.fromDate(date instanceof Date ? date : new Date(date));
}

async function writeSeedSources(sources, actor = 'system-seed') {
  const batch = db.batch();
  for (const source of sources) {
    const ref = db.collection('news_sources').doc(source.id);
    const existing = await ref.get();
    const payload = {
      ...source,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!existing.exists) {
      Object.assign(payload, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: actor,
        lastFetchedAt: null,
        lastError: '',
      });
    }
    batch.set(ref, payload, { merge: true });
  }
  await batch.commit();
  return sources.length;
}

async function seedSources() {
  const snapshot = await db.collection('news_sources').limit(1).get();
  if (!snapshot.empty) return false;
  const sources = [
    ...DEFAULT_INTELLIGENCE_SOURCES.map((source) => ({
      ...source,
      enabled: process.env.RSS_NEWS_ENABLED !== 'false',
    })),
    ...DEFAULT_GDELT_QUERIES.map((query) => ({
      id: `gdelt-${intelligenceHash([query]).slice(0, 12)}`,
      name: `GDELT: ${query}`,
      type: 'gdelt',
      provider: 'gdelt',
      url: 'https://api.gdeltproject.org/api/v2/doc/doc',
      category: 'Threat intelligence',
      language: 'en',
      priority: 82,
      enabled: process.env.GDELT_ENABLED !== 'false',
      fetchIntervalMinutes: 60,
      query,
    })),
    ...DEFAULT_GITHUB_QUERIES.map((query) => ({
      id: `github-${intelligenceHash([query]).slice(0, 12)}`,
      name: `GitHub: ${query}`,
      type: 'github',
      provider: 'github',
      url: 'https://api.github.com/search/repositories',
      category: 'GitHub',
      language: 'en',
      priority: 84,
      enabled: process.env.GITHUB_NEWS_ENABLED !== 'false',
      fetchIntervalMinutes: 180,
      query,
    })),
    {
      id: 'hackernews-top',
      name: 'Hacker News Top Stories',
      type: 'hackernews',
      provider: 'hackernews',
      url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
      category: 'Technology',
      language: 'en',
      priority: 78,
      enabled: process.env.HACKERNEWS_ENABLED !== 'false',
      fetchIntervalMinutes: 60,
      query: '',
    },
    ...(process.env.NEWS_API_KEY
      ? [{
          id: 'newsapi-cybersecurity',
          name: 'NewsAPI: cybersecurity and OSINT',
          type: 'newsapi',
          provider: 'newsapi',
          url: 'https://newsapi.org/v2/everything',
          category: 'Cybersecurity',
          language: process.env.NEWS_DEFAULT_LANGUAGE || 'en',
          priority: 80,
          enabled: true,
          fetchIntervalMinutes: 60,
          query: 'cybersecurity OR OSINT OR threat intelligence',
        }]
      : []),
  ];
  await writeSeedSources(sources);
  return true;
}

export async function seedArabicSources(actor = 'system-seed') {
  return writeSeedSources(buildArabicSeedSources(), actor);
}

export async function seedGreySources(actor = 'system-seed') {
  return writeSeedSources(buildGreySeedSources(), actor);
}

async function createHits(item, itemType, watchlists) {
  for (const watchlistDoc of watchlists) {
    const watchlist = { id: watchlistDoc.id, ...watchlistDoc.data() };
    const typedWatchlist = ['mixed', 'news', 'grey', 'repository'].includes(watchlist.type);
    if (typedWatchlist && watchlist.type !== 'mixed' && watchlist.type !== itemType) continue;
    const hit = matchWatchlist(item, watchlist);
    if (!hit) continue;
    const id = intelligenceHash([watchlist.id, itemType, item.id]);
    await db.collection('watchlist_hits').doc(id).set({
      watchlistId: watchlist.id,
      itemType,
      itemId: item.id,
      ...hit,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('alerts').doc(`watchlist-${id}`).set({
      type: 'watchlist-hit',
      title: `تطابق قائمة المراقبة: ${watchlist.name}`,
      message: hit.matchedText,
      severity: hit.score >= 80 ? 'high' : 'warning',
      itemType,
      itemId: item.id,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

async function saveRepository(item, watchlists) {
  const raw = item.rawPayload || {};
  const fullName = raw.fullName || item.title.split(':')[0];
  const id = intelligenceHash([fullName]);
  const repo = {
    id,
    repoName: String(fullName).split('/').pop() || fullName,
    fullName,
    url: item.url,
    description: item.summary,
    owner: raw.owner || String(fullName).split('/')[0] || '',
    language: raw.language || '',
    topics: raw.topics || [],
    stars: Number(raw.stars || 0),
    forks: Number(raw.forks || 0),
    openIssues: Number(raw.openIssues || 0),
    lastCommitAt: timestamp(raw.pushedAt || item.publishedAt),
    license: raw.license || 'NOASSERTION',
    score: item.score,
    tags: item.tags,
    usefulIdeas: extractRepositoryIdeas({ name: fullName, description: item.summary, topics: raw.topics }),
    implementationPriority: item.score >= 75 ? 'high' : item.score >= 50 ? 'medium' : 'low',
    saved: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('repo_intelligence_items').doc(id).set(repo, { merge: true });
  await createHits(repo, 'repository', watchlists);
}

async function syncSource(sourceDoc, watchlists) {
  const source = { id: sourceDoc.id, ...sourceDoc.data() };
  const startedAt = admin.firestore.Timestamp.now();
  let fetchedCount = 0;
  let insertedCount = 0;
  let duplicateCount = 0;
  let status = 'success';
  let errorMessage = '';
  try {
    if (source.url) await assertPublicUrl(source.url);
    const rawItems = await fetchProvider(source, maxItems);
    fetchedCount = rawItems.length;
    for (const raw of rawItems) {
      const normalized = normalizeNewsItem(raw, source);
      const isGrey = source.intelligence_scope === 'grey'
        || source.source_type === 'grey_metadata_only'
        || source.category === 'المصادر الرمادية'
        || source.data_sensitivity === 'مؤشر تسريب'
        || source.data_sensitivity === 'محظور التخزين';
      const item = isGrey
        ? toGreyMetadataItem(normalized, source)
        : toArabicIntelligenceItem(normalized, source);
      if (!item.title) continue;
      const collectionName = isGrey ? 'grey_intel_items' : 'news_items';
      const ref = db.collection(collectionName).doc(item.id);
      if ((await ref.get()).exists) {
        duplicateCount += 1;
        continue;
      }
      await ref.create({
        ...item,
        publishedAt: timestamp(item.publishedAt),
        fetchedAt: timestamp(item.fetchedAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      insertedCount += 1;
      await createHits(item, isGrey ? 'grey' : 'news', watchlists);
      if (!isGrey && item.provider === 'github') await saveRepository(item, watchlists);
      const itemScore = Number(item.score || (item.risk_level === 'حرج' ? 95 : item.risk_level === 'مرتفع' ? 75 : 45));
      if (itemScore >= 85 || item.risk_level === 'حرج') {
        await db.collection('alerts').doc(`score-${item.id}`).set({
          type: isGrey ? 'leak-indicator' : item.entities.cves.length ? 'cve' : 'high-score',
          title: item.title,
          message: item.summary_ar || item.summary || item.contentSnippet_ar || item.contentSnippet,
          severity: itemScore >= 95 ? 'critical' : 'high',
          itemType: isGrey ? 'grey' : 'news',
          itemId: item.id,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
    await sourceDoc.ref.update({
      lastFetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    status = 'failed';
    errorMessage = (error instanceof Error ? error.message : 'Unknown provider error').slice(0, 500);
    await sourceDoc.ref.update({
      lastFetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: errorMessage,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('alerts').add({
      type: 'fetch-failure',
      title: `فشل المصدر: ${source.name}`,
      message: errorMessage,
      severity: 'warning',
      itemType: 'source',
      itemId: source.id,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await db.collection('news_fetch_logs').add({
    sourceId: source.id,
    provider: source.provider,
    status,
    fetchedCount,
    insertedCount,
    duplicateCount,
    errorMessage,
    startedAt,
    finishedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { source: source.name, status, fetchedCount, insertedCount, duplicateCount, errorMessage };
}

export async function runIntelligenceSync(options = {}) {
  await seedSources();
  const requests = await db.collection('intelligence_requests').where('status', '==', 'pending').limit(100).get();
  const requestTypes = new Set(requests.docs.map((doc) => doc.data().type).filter(Boolean));
  const requestedScopes = new Set(requests.docs.map((doc) => doc.data().scope).filter((value) => value && value !== 'all'));
  if (process.env.ARABIC_NEWS_ENABLED !== 'false' || requestTypes.has('seed-arabic')) await seedArabicSources();
  if (process.env.GREY_INTEL_ENABLED !== 'false' || requestTypes.has('seed-grey')) await seedGreySources();
  const requestedProviders = new Set(requests.docs.map((doc) => doc.data().provider).filter(Boolean));
  const force = options.force === true || !requests.empty || Boolean(options.provider);
  const sourceQuery = db.collection('news_sources').where('enabled', '==', true);
  const [sources, watchlists] = await Promise.all([
    sourceQuery.get(),
    db.collection('watchlists').where('enabled', '==', true).get(),
  ]);
  const now = Date.now();
  const filtered = sources.docs.filter((doc) => {
    const source = doc.data();
    const isGrey = source.intelligence_scope === 'grey'
      || source.source_type === 'grey_metadata_only'
      || source.category === 'المصادر الرمادية';
    const effectiveScopes = options.scope ? new Set([options.scope]) : requestedScopes;
    if (effectiveScopes.has('arabic') && !effectiveScopes.has('grey') && (isGrey || source.language !== 'ar')) return false;
    if (effectiveScopes.has('grey') && !effectiveScopes.has('arabic') && !isGrey) return false;
    const providerAllowed = !options.provider && !requestedProviders.size
      ? true
      : source.provider === options.provider || requestedProviders.has(source.provider);
    const lastFetched = source.lastFetchedAt?.toDate?.().getTime() || 0;
    const due = now - lastFetched >= Number(source.fetchIntervalMinutes || 60) * 60_000;
    return providerAllowed && (force || due);
  });
  const results = [];
  for (const source of filtered) results.push(await syncSource(source, watchlists.docs));
  if (!requests.empty) {
    const batch = db.batch();
    requests.docs.forEach((request) => batch.update(request.ref, {
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    }));
    await batch.commit();
  }
  return { syncedAt: new Date().toISOString(), sourceCount: filtered.length, results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await runIntelligenceSync({
    provider: process.env.NEWS_PROVIDER || '',
  }), null, 2));
}
