import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import admin from 'firebase-admin';
import { pathToFileURL } from 'node:url';
import { normalizeNewsItem, extractRepositoryIdeas, intelligenceHash } from '../scripts/intelligence-lib.mjs';
import { assertPublicUrl } from '../scripts/feed-lib.mjs';
import { buildArabicExecutiveReport, LEGAL_NOTICE } from '../scripts/arabic-intelligence-lib.mjs';
import { createSummaryService } from '../scripts/ai-summary.mjs';
import { fetchGitHubNews } from '../scripts/provider-client.mjs';
import {
  runIntelligenceSync,
  seedArabicSources,
  seedGreySources,
} from '../scripts/sync-intelligence.mjs';

const projectId = process.env.FIREBASE_PROJECT_ID || 'm3tm-rased-07246627-7b0bf';
if (!admin.apps.length) {
  const credential = process.env.FIREBASE_SERVICE_ACCOUNT_M3TM_RASED
    ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_M3TM_RASED))
    : admin.credential.applicationDefault();
  admin.initializeApp({ credential, projectId });
}
const db = admin.firestore();
const summaryService = createSummaryService();
const port = Number(process.env.PORT || 8080);
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || 'https://m3tm.app,https://m3tm-rased-07246627-7b0bf.web.app')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const requestWindows = new Map();

function json(response, status, payload, origin = '') {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    ...(origin && allowedOrigins.has(origin)
      ? { 'access-control-allow-origin': origin, vary: 'origin' }
      : {}),
  });
  response.end(JSON.stringify(payload));
}

function enforceRateLimit(request, pathname) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const identity = forwarded || request.socket.remoteAddress || 'unknown';
  const expensive = /\/(?:fetch|refresh|seed|search)/.test(pathname);
  const limit = expensive ? 20 : 180;
  const now = Date.now();
  const key = `${identity}:${expensive ? 'expensive' : 'standard'}`;
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    if (requestWindows.size > 10_000) {
      for (const [windowKey, value] of requestWindows) {
        if (now - value.startedAt >= 60_000) requestWindows.delete(windowKey);
      }
    }
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw Object.assign(new Error('Rate limit exceeded.'), { status: 429 });
  }
}

function serialize(value) {
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

async function body(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!size) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function identity(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  const decoded = await admin.auth().verifyIdToken(token);
  const profile = await db.collection('users').doc(decoded.uid).get();
  const data = profile.data();
  if (!profile.exists || data?.active !== true) {
    throw Object.assign(new Error('Active invitation profile required.'), { status: 403 });
  }
  return { uid: decoded.uid, email: decoded.email || '', role: data.role || 'user' };
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw Object.assign(new Error('Insufficient permissions.'), { status: 403 });
}

async function audit(user, action, targetType, targetId, details = {}) {
  await db.collection('audit_logs').add({
    actorId: user.uid,
    actorEmail: user.email,
    action,
    targetType,
    targetId,
    details,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function pageParams(url) {
  return {
    page: Math.max(1, Number(url.searchParams.get('page') || 1)),
    limit: Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 25))),
  };
}

function validSchedulerSecret(request) {
  const expected = process.env.SCHEDULER_SECRET || '';
  const received = String(request.headers['x-m3tm-scheduler-key'] || '');
  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function listCollection(name, orderField, maximum = 500) {
  const snapshot = await db.collection(name).orderBy(orderField, 'desc').limit(maximum).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...serialize(doc.data()) }));
}

async function listNews(url, user = null) {
  const { page, limit } = pageParams(url);
  const all = await listCollection('news_items', 'publishedAt');
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const minScore = Number(url.searchParams.get('min_score') || 0);
  const from = url.searchParams.get('date_from');
  const to = url.searchParams.get('date_to');
  let bookmarkedIds = null;
  if (url.searchParams.get('bookmarked') === 'true' && user) {
    const bookmarks = await db.collection('news_bookmarks').where('userId', '==', user.uid).limit(500).get();
    bookmarkedIds = new Set(bookmarks.docs.map((doc) => doc.data().newsId));
  }
  const filtered = all.filter((item) => {
    const text = `${item.title} ${item.summary_ar || item.summary} ${item.contentSnippet_ar || item.contentSnippet} ${(item.tags_ar || item.tags || []).join(' ')}`.toLowerCase();
    const published = new Date(item.publishedAt);
    return (!q || text.includes(q))
      && (!url.searchParams.get('category') || item.category === url.searchParams.get('category'))
      && (!url.searchParams.get('source') || item.source === url.searchParams.get('source'))
      && (!url.searchParams.get('provider') || item.provider === url.searchParams.get('provider'))
      && (!url.searchParams.get('language') || item.language === url.searchParams.get('language'))
      && (!url.searchParams.get('country') || item.country === url.searchParams.get('country'))
      && (!url.searchParams.get('region') || item.region === url.searchParams.get('region'))
      && (!url.searchParams.get('risk_level') || item.risk_level === url.searchParams.get('risk_level'))
      && Number(item.score || 0) >= minScore
      && (!from || published >= new Date(from))
      && (!to || published <= new Date(to))
      && (!bookmarkedIds || bookmarkedIds.has(item.id));
  });
  return {
    items: filtered.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total: filtered.length },
  };
}

async function listGreyIntel(url) {
  const { page, limit } = pageParams(url);
  const all = await listCollection('grey_intel_items', 'publishedAt');
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const filtered = all.filter((item) => {
    const text = `${item.title} ${item.summary_ar} ${item.source} ${(item.tags_ar || []).join(' ')} ${(item.affected_entities || []).join(' ')}`.toLowerCase();
    return (!q || text.includes(q))
      && (!url.searchParams.get('category') || item.category === url.searchParams.get('category'))
      && (!url.searchParams.get('country') || item.country === url.searchParams.get('country'))
      && (!url.searchParams.get('risk_level') || item.risk_level === url.searchParams.get('risk_level'))
      && (!url.searchParams.get('data_sensitivity') || item.data_sensitivity === url.searchParams.get('data_sensitivity'));
  });
  return {
    items: filtered.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total: filtered.length },
  };
}

function watchlistPayload(input, userId, existing = null) {
  const type = String(input.type || existing?.type || 'mixed');
  if (![
    'mixed', 'news', 'repository', 'دولة', 'شركة', 'جهة حكومية', 'شخص',
    'دومين', 'بريد', 'CVE', 'جماعة/فصيل', 'كلمة مفتاحية',
    'مستودع GitHub', 'مصدر إخباري',
  ].includes(type)) {
    throw Object.assign(new Error('Unsupported watchlist type.'), { status: 400 });
  }
  const strings = (value) =>
    (Array.isArray(value) ? value : [])
      .map((item) => String(item).trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 100);
  const channels = strings(input.notifyChannels ?? existing?.notifyChannels ?? ['dashboard'])
    .filter((value) => ['dashboard', 'email', 'telegram'].includes(value));
  return {
    name: String(input.name || existing?.name || '').trim().slice(0, 160),
    type,
    keywords: strings(input.keywords ?? existing?.keywords),
    entities: strings(input.entities ?? existing?.entities),
    enabled: Boolean(input.enabled ?? existing?.enabled ?? true),
    notifyChannels: channels.length ? channels : ['dashboard'],
    createdBy: existing?.createdBy || userId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function sourcePayload(input, userId, existing = null) {
  const provider = String(input.provider || input.type || existing?.provider || 'rss');
  if (!['rss', 'gdelt', 'hackernews', 'github', 'newsapi', 'cisa_kev', 'custom'].includes(provider)) {
    throw Object.assign(new Error('Unsupported provider.'), { status: 400 });
  }
  const url = new URL(String(input.url || existing?.url || ''));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw Object.assign(new Error('A safe HTTP(S) URL is required.'), { status: 400 });
  }
  await assertPublicUrl(url.toString());
  return {
    name: String(input.name || existing?.name || '').trim().slice(0, 160),
    type: provider,
    provider,
    source_type: String(input.source_type || existing?.source_type || (provider === 'gdelt' ? 'gdelt_query' : 'rss')).slice(0, 40),
    url: url.toString(),
    query: String(input.query ?? existing?.query ?? '').trim().slice(0, 300),
    category: String(input.category || existing?.category || 'General').trim().slice(0, 100),
    language: String(input.language || existing?.language || 'en').trim().slice(0, 12),
    priority: Math.max(0, Math.min(100, Math.round(Number(input.priority ?? existing?.priority ?? 75)))),
    reliability_score: Math.max(0, Math.min(100, Math.round(Number(input.reliability_score ?? existing?.reliability_score ?? 70)))),
    enabled: Boolean(input.enabled ?? existing?.enabled ?? true),
    fetchIntervalMinutes: Math.max(15, Math.min(1440, Math.round(Number(input.fetchIntervalMinutes ?? existing?.fetchIntervalMinutes ?? 60)))),
    createdBy: existing?.createdBy || userId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function createArabicReport(user, input, presetItems = []) {
  const greyItems = presetItems.filter((item) => item.data_sensitivity || item.source_type === 'grey_metadata_only');
  const newsItems = presetItems.filter((item) => !greyItems.includes(item));
  const generated = buildArabicExecutiveReport({
    type: input.type || 'موجز استخباري إقليمي',
    title: input.title || `موجز استخباري - ${new Date().toISOString().slice(0, 10)}`,
    coverage: input.coverage || 'آخر 7 أيام',
    items: newsItems,
    greyItems,
    riskLevel: input.riskLevel,
  });
  const ref = await db.collection('intelligence_reports').add({
    ...generated,
    newsIds: Array.isArray(input.newsIds) ? input.newsIds.slice(0, 200) : [],
    greyIntelIds: Array.isArray(input.greyIntelIds) ? input.greyIntelIds.slice(0, 200) : [],
    repositoryIds: Array.isArray(input.repositoryIds) ? input.repositoryIds.slice(0, 200) : [],
    legalNotice: LEGAL_NOTICE,
    createdBy: user.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function createTask(user, input) {
  const ref = await db.collection('tasks').add({
    title: String(input.title || 'مهمة استخبارية').slice(0, 220),
    description: String(input.description || '').slice(0, 3000),
    status: 'open',
    sourceType: input.sourceType || 'news',
    sourceIds: Array.isArray(input.sourceIds) ? input.sourceIds.slice(0, 100) : [],
    createdBy: user.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function createReport(user, input) {
  const ref = await db.collection('reports').add({
    title: String(input.title || 'تقرير استخباري').slice(0, 220),
    format: ['json', 'markdown', 'html'].includes(input.format) ? input.format : 'markdown',
    status: 'draft',
    newsIds: Array.isArray(input.newsIds) ? input.newsIds.slice(0, 100) : [],
    repositoryIds: Array.isArray(input.repositoryIds) ? input.repositoryIds.slice(0, 100) : [],
    content: String(input.content || '').slice(0, 50_000),
    createdBy: user.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function handler(request, response) {
  const origin = String(request.headers.origin || '');
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      ...(allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      vary: 'origin',
    });
    response.end();
    return;
  }
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  enforceRateLimit(request, url.pathname);
  if (url.pathname === '/health') return json(response, 200, { status: 'ok', projectId }, origin);
  if (request.method === 'POST' && url.pathname === '/internal/scheduler/refresh') {
    if (!validSchedulerSecret(request)) {
      return json(response, 401, { error: 'Invalid scheduler credential.' }, origin);
    }
    return json(response, 200, await runIntelligenceSync({ force: true }), origin);
  }
  const user = await identity(request);

  if (request.method === 'GET' && url.pathname === '/news') {
    return json(response, 200, await listNews(url, user), origin);
  }
  if (request.method === 'POST' && url.pathname === '/news/sources/seed-arabic') {
    requireRole(user, ['admin']);
    const count = await seedArabicSources(user.uid);
    await audit(user, 'source.seed-arabic', 'news_source', 'arabic-defaults', { count });
    return json(response, 200, { seeded: count }, origin);
  }
  if (request.method === 'POST' && url.pathname === '/news/fetch-arabic') {
    requireRole(user, ['admin']);
    const result = await runIntelligenceSync({ force: true, scope: 'arabic' });
    await audit(user, 'intelligence.fetch-arabic', 'system', 'arabic');
    return json(response, 200, result, origin);
  }
  if (request.method === 'GET' && url.pathname === '/news/arabic-dashboard') {
    const items = (await listNews(new URL('/news?limit=100', 'http://localhost'), user)).items;
    const critical = items.filter((item) => item.risk_level === 'حرج').length;
    const high = items.filter((item) => item.risk_level === 'مرتفع').length;
    return json(response, 200, {
      total: items.length,
      critical,
      high,
      byCategory: items.reduce((counts, item) => {
        const category = item.category || 'غير مصنف';
        counts[category] = (counts[category] || 0) + 1;
        return counts;
      }, {}),
      latest: items.slice(0, 10),
    }, origin);
  }
  const newsMatch = url.pathname.match(/^\/news\/([^/]+)$/);
  const reservedNewsPaths = new Set(['sources', 'fetch-logs', 'stats', 'arabic-dashboard']);
  if (request.method === 'GET' && newsMatch && !reservedNewsPaths.has(newsMatch[1])) {
    const snapshot = await db.collection('news_items').doc(newsMatch[1]).get();
    if (!snapshot.exists) return json(response, 404, { error: 'News item not found.' }, origin);
    return json(response, 200, { id: snapshot.id, ...serialize(snapshot.data()) }, origin);
  }
  if (request.method === 'POST' && ['/news/fetch', '/news/refresh'].includes(url.pathname)) {
    requireRole(user, ['admin']);
    const input = await body(request);
    const result = await runIntelligenceSync({ provider: url.pathname.endsWith('/fetch') ? input.provider : '' });
    await audit(user, 'intelligence.refresh', 'system', input.provider || 'all');
    return json(response, 200, result, origin);
  }
  const bookmarkMatch = url.pathname.match(/^\/news\/([^/]+)\/bookmark$/);
  if (bookmarkMatch && ['POST', 'DELETE'].includes(request.method || '')) {
    const ref = db.collection('news_bookmarks').doc(`${user.uid}_${bookmarkMatch[1]}`);
    if (request.method === 'DELETE') await ref.delete();
    else await ref.set({ userId: user.uid, newsId: bookmarkMatch[1], createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return json(response, 200, { bookmarked: request.method === 'POST' }, origin);
  }
  const summarizeMatch = url.pathname.match(/^\/news\/([^/]+)\/(?:summarize|summarize-arabic)$/);
  if (request.method === 'POST' && summarizeMatch) {
    requireRole(user, ['admin', 'manager']);
    const ref = db.collection('news_items').doc(summarizeMatch[1]);
    const snapshot = await ref.get();
    if (!snapshot.exists) return json(response, 404, { error: 'News item not found.' }, origin);
    const data = snapshot.data();
    const summary = await summaryService.summarize(data);
    await ref.update({ summary, summary_ar: summary, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return json(response, 200, { summary }, origin);
  }
  const taskMatch = url.pathname.match(/^\/news\/([^/]+)\/create-task$/);
  if (request.method === 'POST' && taskMatch) {
    const input = await body(request);
    return json(response, 201, { id: await createTask(user, { ...input, sourceType: 'news', sourceIds: [taskMatch[1]] }) }, origin);
  }
  const reportMatch = url.pathname.match(/^\/news\/([^/]+)\/create-report$/);
  if (request.method === 'POST' && reportMatch) {
    const input = await body(request);
    return json(response, 201, { id: await createReport(user, { ...input, newsIds: [reportMatch[1]] }) }, origin);
  }
  if (request.method === 'POST' && url.pathname === '/news/bulk-report') {
    const input = await body(request);
    return json(response, 201, { id: await createReport(user, { ...input, newsIds: input.news_ids || [] }) }, origin);
  }
  if (request.method === 'GET' && url.pathname === '/news/sources') {
    const items = await listCollection('news_sources', 'updatedAt');
    return json(response, 200, { items }, origin);
  }
  if (request.method === 'POST' && url.pathname === '/news/sources') {
    requireRole(user, ['admin']);
    const input = await body(request);
    const payload = await sourcePayload(input, user.uid);
    const ref = await db.collection('news_sources').add({ ...payload, createdAt: admin.firestore.FieldValue.serverTimestamp(), lastFetchedAt: null, lastError: '' });
    await audit(user, 'source.create', 'news_source', ref.id, { name: payload.name });
    return json(response, 201, { id: ref.id }, origin);
  }
  const sourceMatch = url.pathname.match(/^\/news\/sources\/([^/]+)$/);
  if (sourceMatch && ['PATCH', 'DELETE'].includes(request.method || '')) {
    requireRole(user, ['admin']);
    const ref = db.collection('news_sources').doc(sourceMatch[1]);
    const snapshot = await ref.get();
    if (!snapshot.exists) return json(response, 404, { error: 'Source not found.' }, origin);
    if (request.method === 'DELETE') await ref.delete();
    else await ref.update(await sourcePayload(await body(request), user.uid, snapshot.data()));
    await audit(user, `source.${request.method === 'DELETE' ? 'delete' : 'update'}`, 'news_source', sourceMatch[1]);
    return json(response, 200, { ok: true }, origin);
  }
  if (request.method === 'GET' && url.pathname === '/news/fetch-logs') {
    requireRole(user, ['admin']);
    return json(response, 200, { items: await listCollection('news_fetch_logs', 'startedAt', 100) }, origin);
  }
  if (request.method === 'GET' && url.pathname === '/news/stats') {
    const items = (await listNews(new URL('/news?limit=100', 'http://localhost'), user)).items;
    const byCategory = {};
    const bySource = {};
    for (const item of items) {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      bySource[item.source] = (bySource[item.source] || 0) + 1;
    }
    const logs = await listCollection('news_fetch_logs', 'startedAt', 1);
    return json(response, 200, {
      totalNews: items.length,
      byCategory,
      bySource,
      topKeywords: [],
      latestFetchStatus: logs[0] || null,
      averageScore: items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length) : 0,
    }, origin);
  }
  if (request.method === 'GET' && url.pathname === '/grey-intel') {
    return json(response, 200, await listGreyIntel(url), origin);
  }
  if (request.method === 'POST' && url.pathname === '/grey-intel/sources/seed') {
    requireRole(user, ['admin']);
    const count = await seedGreySources(user.uid);
    await audit(user, 'source.seed-grey', 'news_source', 'grey-defaults', { count });
    return json(response, 200, { seeded: count }, origin);
  }
  if (request.method === 'POST' && url.pathname === '/grey-intel/fetch') {
    requireRole(user, ['admin']);
    const result = await runIntelligenceSync({ force: true, scope: 'grey' });
    await audit(user, 'intelligence.fetch-grey', 'system', 'grey');
    return json(response, 200, result, origin);
  }
  if (request.method === 'GET' && url.pathname === '/grey-intel/dashboard') {
    const items = (await listGreyIntel(new URL('/grey-intel?limit=100', 'http://localhost'))).items;
    return json(response, 200, {
      total: items.length,
      critical: items.filter((item) => item.risk_level === 'حرج').length,
      possibleLeaks: items.filter((item) => item.data_sensitivity !== 'عام').length,
      latest: items.slice(0, 10),
      legalNotice: LEGAL_NOTICE,
    }, origin);
  }
  if (request.method === 'POST' && url.pathname === '/grey-intel/watchlist/check') {
    requireRole(user, ['admin', 'manager']);
    const result = await runIntelligenceSync({ force: true, scope: 'grey' });
    return json(response, 200, result, origin);
  }
  const greyBookmarkMatch = url.pathname.match(/^\/grey-intel\/([^/]+)\/bookmark$/);
  if (request.method === 'POST' && greyBookmarkMatch) {
    await db.collection('grey_bookmarks').doc(`${user.uid}_${greyBookmarkMatch[1]}`).set({
      userId: user.uid,
      itemId: greyBookmarkMatch[1],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return json(response, 200, { bookmarked: true }, origin);
  }
  const greyActionMatch = url.pathname.match(/^\/grey-intel\/([^/]+)\/(create-report|create-task)$/);
  if (request.method === 'POST' && greyActionMatch) {
    const input = await body(request);
    const [, itemId, action] = greyActionMatch;
    if (action === 'create-task') {
      return json(response, 201, { id: await createTask(user, { ...input, sourceType: 'news', sourceIds: [itemId] }) }, origin);
    }
    const snapshot = await db.collection('grey_intel_items').doc(itemId).get();
    if (!snapshot.exists) return json(response, 404, { error: 'Grey intelligence item not found.' }, origin);
    return json(response, 201, {
      id: await createArabicReport(user, {
        ...input,
        type: 'تقرير التسريبات والمصادر الرمادية',
        greyIntelIds: [itemId],
      }, [{ id: itemId, ...serialize(snapshot.data()) }]),
    }, origin);
  }
  const greyItemMatch = url.pathname.match(/^\/grey-intel\/([^/]+)$/);
  if (request.method === 'GET' && greyItemMatch) {
    const snapshot = await db.collection('grey_intel_items').doc(greyItemMatch[1]).get();
    if (!snapshot.exists) return json(response, 404, { error: 'Grey intelligence item not found.' }, origin);
    return json(response, 200, { id: snapshot.id, ...serialize(snapshot.data()) }, origin);
  }
  if (request.method === 'GET' && url.pathname === '/repos/intelligence') {
    return json(response, 200, { items: await listCollection('repo_intelligence_items', 'score', 300) }, origin);
  }
  if (request.method === 'POST' && url.pathname === '/repos/search') {
    requireRole(user, ['admin', 'manager']);
    const input = await body(request);
    const rawItems = await fetchGitHubNews({ query: String(input.query || 'OSINT dashboard') }, Math.min(100, Number(input.limit || 25)));
    const saved = [];
    for (const raw of rawItems) {
      const item = normalizeNewsItem(raw, { name: 'GitHub', provider: 'github', category: 'GitHub', priority: 85 });
      const fullName = raw.rawPayload?.fullName || item.title.split(':')[0];
      const id = intelligenceHash([fullName]);
      await db.collection('repo_intelligence_items').doc(id).set({
        repoName: String(fullName).split('/').pop(),
        fullName,
        url: item.url,
        description: item.summary,
        owner: raw.rawPayload?.owner || '',
        language: raw.rawPayload?.language || '',
        topics: raw.rawPayload?.topics || [],
        stars: raw.rawPayload?.stars || 0,
        forks: raw.rawPayload?.forks || 0,
        openIssues: raw.rawPayload?.openIssues || 0,
        lastCommitAt: admin.firestore.Timestamp.fromDate(new Date(raw.rawPayload?.pushedAt || Date.now())),
        license: raw.rawPayload?.license || 'NOASSERTION',
        score: item.score,
        tags: item.tags,
        usefulIdeas: extractRepositoryIdeas({ name: fullName, description: item.summary, topics: raw.rawPayload?.topics }),
        implementationPriority: item.score >= 75 ? 'high' : item.score >= 50 ? 'medium' : 'low',
        saved: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      saved.push(id);
    }
    return json(response, 200, { saved: saved.length, ids: saved }, origin);
  }
  const repoAction = url.pathname.match(/^\/repos\/([^/]+)\/(save|create-idea|create-task)$/);
  if (request.method === 'POST' && repoAction) {
    const [, id, action] = repoAction;
    const input = await body(request);
    if (action === 'save') {
      await db.collection('repo_intelligence_items').doc(id).update({ saved: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return json(response, 200, { saved: true }, origin);
    }
    if (action === 'create-task') {
      return json(response, 201, { id: await createTask(user, { ...input, sourceType: 'repository', sourceIds: [id] }) }, origin);
    }
    const ref = await db.collection('repository_ideas').add({
      repositoryId: id,
      title: String(input.title || 'فكرة من مستودع').slice(0, 220),
      description: String(input.description || '').slice(0, 3000),
      createdBy: user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return json(response, 201, { id: ref.id }, origin);
  }
  if (request.method === 'GET' && url.pathname === '/repos/ideas') {
    return json(response, 200, { items: await listCollection('repository_ideas', 'createdAt', 200) }, origin);
  }
  if (request.method === 'GET' && url.pathname === '/watchlists') {
    const all = await listCollection('watchlists', 'updatedAt', 200);
    return json(response, 200, { items: user.role === 'user' ? all.filter((item) => item.createdBy === user.uid) : all }, origin);
  }
  if (request.method === 'POST' && url.pathname === '/watchlists') {
    const input = await body(request);
    const ref = await db.collection('watchlists').add({
      ...watchlistPayload(input, user.uid),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return json(response, 201, { id: ref.id }, origin);
  }
  const watchMatch = url.pathname.match(/^\/watchlists\/([^/]+)(?:\/hits)?$/);
  if (watchMatch) {
    const ref = db.collection('watchlists').doc(watchMatch[1]);
    const snapshot = await ref.get();
    if (!snapshot.exists) return json(response, 404, { error: 'Watchlist not found.' }, origin);
    if (user.role === 'user' && snapshot.data().createdBy !== user.uid) {
      throw Object.assign(new Error('Insufficient permissions.'), { status: 403 });
    }
    if (request.method === 'GET' && url.pathname.endsWith('/hits')) {
      const hits = await db.collection('watchlist_hits').where('watchlistId', '==', watchMatch[1]).limit(200).get();
      return json(response, 200, { items: hits.docs.map((doc) => ({ id: doc.id, ...serialize(doc.data()) })) }, origin);
    }
    if (request.method === 'GET') return json(response, 200, { id: snapshot.id, ...serialize(snapshot.data()) }, origin);
    if (request.method === 'DELETE') {
      await ref.delete();
      return json(response, 200, { ok: true }, origin);
    }
    if (request.method === 'PATCH') {
      const input = await body(request);
      await ref.update(watchlistPayload(input, user.uid, snapshot.data()));
      return json(response, 200, { ok: true }, origin);
    }
  }
  if (request.method === 'GET' && url.pathname === '/alerts') {
    return json(response, 200, { items: await listCollection('alerts', 'createdAt', 200) }, origin);
  }
  if (request.method === 'POST' && url.pathname === '/alerts/read-all') {
    const snapshot = await db.collection('alerts').where('read', '==', false).limit(500).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, { read: true }));
    if (!snapshot.empty) await batch.commit();
    return json(response, 200, { updated: snapshot.size }, origin);
  }
  const alertMatch = url.pathname.match(/^\/alerts\/([^/]+)\/read$/);
  if (request.method === 'POST' && alertMatch) {
    await db.collection('alerts').doc(alertMatch[1]).update({ read: true });
    return json(response, 200, { read: true }, origin);
  }
  if (request.method === 'POST' && ['/reports/intelligence', '/reports/arabic-brief', '/reports/grey-intel'].includes(url.pathname)) {
    const input = await body(request);
    const newsIds = Array.isArray(input.newsIds) ? input.newsIds.slice(0, 200) : [];
    const greyIds = Array.isArray(input.greyIntelIds) ? input.greyIntelIds.slice(0, 200) : [];
    const [newsDocs, greyDocs] = await Promise.all([
      Promise.all(newsIds.map((id) => db.collection('news_items').doc(id).get())),
      Promise.all(greyIds.map((id) => db.collection('grey_intel_items').doc(id).get())),
    ]);
    const items = [...newsDocs, ...greyDocs]
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => ({ id: snapshot.id, ...serialize(snapshot.data()) }));
    const defaults = url.pathname.endsWith('/grey-intel')
      ? 'تقرير التسريبات والمصادر الرمادية'
      : url.pathname.endsWith('/arabic-brief')
        ? 'موجز استخباري إقليمي'
        : 'تقرير أسبوعي تنفيذي';
    return json(response, 201, {
      id: await createArabicReport(user, { ...input, type: input.type || defaults }, items),
    }, origin);
  }
  const intelligenceReportMatch = url.pathname.match(/^\/reports\/([^/]+)$/);
  if (request.method === 'GET' && intelligenceReportMatch) {
    const snapshot = await db.collection('intelligence_reports').doc(intelligenceReportMatch[1]).get();
    if (!snapshot.exists) return json(response, 404, { error: 'Report not found.' }, origin);
    const data = snapshot.data();
    if (!['admin', 'manager'].includes(user.role) && data.createdBy !== user.uid) {
      throw Object.assign(new Error('Insufficient permissions.'), { status: 403 });
    }
    return json(response, 200, { id: snapshot.id, ...serialize(data) }, origin);
  }
  return json(response, 404, { error: 'Route not found.' }, origin);
}

export const server = http.createServer((request, response) => {
  handler(request, response).catch((error) => {
    console.error(JSON.stringify({
      severity: 'ERROR',
      message: error instanceof Error ? error.message : 'Unknown API error',
      path: request.url,
    }));
    json(response, Number(error?.status || 500), {
      error: Number(error?.status || 500) >= 500 ? 'Internal server error.' : error.message,
    }, String(request.headers.origin || ''));
  });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(port, '0.0.0.0', () => {
    console.log(JSON.stringify({ severity: 'INFO', message: 'M3TM intelligence API started', port, projectId }));
  });
}
