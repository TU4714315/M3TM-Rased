import { assertPublicUrl, fetchFeed, parseFeed } from './feed-lib.mjs';

const DEFAULT_TIMEOUT_MS = Number(process.env.NEWS_FETCH_TIMEOUT_SECONDS || 15) * 1000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson(urlValue, options = {}, redirects = 0) {
  const url = await assertPublicUrl(urlValue);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'M3TM-Intelligence/1.0',
        ...(options.headers ?? {}),
      },
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= MAX_REDIRECTS) throw new Error('Too many redirects.');
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without location.');
      return fetchJson(new URL(location, url).toString(), options, redirects + 1);
    }
    if (response.status === 429) throw new Error('Provider rate limit reached.');
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > maxBytes) throw new Error('Provider response is too large.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Provider response has no body.');
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('Provider response exceeded the size limit.');
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(body));
  } finally {
    clearTimeout(timeout);
  }
}

export async function withRetry(operation, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(250 * 2 ** attempt);
    }
  }
  throw lastError;
}

export async function fetchRss(source, limit) {
  const xml = await withRetry(() => fetchFeed(source.url || source.feedUrl, 0, {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxResponseBytes: DEFAULT_MAX_BYTES,
  }));
  return parseFeed(xml).slice(0, limit).map((item) => ({ ...item, provider: 'rss' }));
}

export async function fetchGdelt(source, limit) {
  const query = source.query || source.name || 'cybersecurity';
  const endpoint = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  endpoint.searchParams.set('query', query);
  endpoint.searchParams.set('mode', 'ArtList');
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('maxrecords', String(Math.min(limit, 250)));
  endpoint.searchParams.set('sort', 'HybridRel');
  const payload = await withRetry(() => fetchJson(endpoint.toString()));
  return (payload.articles ?? []).slice(0, limit).map((article) => ({
    title: article.title,
    url: article.url,
    source: article.domain,
    language: article.language,
    imageUrl: article.socialimage,
    publishedAt: article.seendate,
    provider: 'gdelt',
    rawPayload: {
      domain: article.domain,
      sourceCountry: article.sourcecountry,
      tone: article.tone,
    },
  }));
}

export async function fetchHackerNews(_source, limit) {
  const ids = await withRetry(() =>
    fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json', { maxBytes: 512 * 1024 }),
  );
  const selected = (Array.isArray(ids) ? ids : []).slice(0, Math.min(limit, 40));
  const items = await Promise.all(
    selected.map((id) =>
      withRetry(() =>
        fetchJson(`https://hacker-news.firebaseio.com/v0/item/${Number(id)}.json`, {
          maxBytes: 256 * 1024,
        }),
      ),
    ),
  );
  return items.filter(Boolean).map((item) => ({
    title: item.title,
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    author: item.by,
    publishedAt: new Date(Number(item.time || 0) * 1000).toISOString(),
    provider: 'hackernews',
    tags: ['Hacker News'],
    rawPayload: { id: item.id, score: item.score, descendants: item.descendants },
  }));
}

export async function fetchGitHubNews(source, limit) {
  const query = source.query || source.name || 'OSINT dashboard';
  const endpoint = new URL('https://api.github.com/search/repositories');
  endpoint.searchParams.set('q', `${query} archived:false`);
  endpoint.searchParams.set('sort', 'updated');
  endpoint.searchParams.set('order', 'desc');
  endpoint.searchParams.set('per_page', String(Math.min(limit, 100)));
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const payload = await withRetry(() => fetchJson(endpoint.toString(), { headers }));
  return (payload.items ?? []).slice(0, limit).map((repo) => ({
    title: `${repo.full_name}: ${repo.description || 'GitHub repository'}`,
    url: repo.html_url,
    source: 'GitHub',
    author: repo.owner?.login,
    summary: repo.description,
    publishedAt: repo.updated_at,
    provider: 'github',
    stars: repo.stargazers_count,
    tags: repo.topics,
    rawPayload: {
      id: repo.id,
      fullName: repo.full_name,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      license: repo.license?.spdx_id,
      topics: repo.topics,
      owner: repo.owner?.login,
      pushedAt: repo.pushed_at,
    },
  }));
}

export async function fetchNewsApi(source, limit) {
  if (!process.env.NEWS_API_KEY) throw new Error('NEWS_API_KEY is not configured.');
  const endpoint = new URL('https://newsapi.org/v2/everything');
  endpoint.searchParams.set('q', source.query || source.name || 'cybersecurity');
  endpoint.searchParams.set('pageSize', String(Math.min(limit, 100)));
  endpoint.searchParams.set('sortBy', 'publishedAt');
  endpoint.searchParams.set('language', source.language || 'en');
  const payload = await withRetry(() =>
    fetchJson(endpoint.toString(), { headers: { 'x-api-key': process.env.NEWS_API_KEY } }),
  );
  return (payload.articles ?? []).slice(0, limit).map((article) => ({
    title: article.title,
    url: article.url,
    source: article.source?.name,
    author: article.author,
    summary: article.description,
    contentSnippet: article.content,
    imageUrl: article.urlToImage,
    publishedAt: article.publishedAt,
    provider: 'newsapi',
  }));
}

export async function fetchProvider(source, limit) {
  if (source.provider === 'rss' || source.type === 'rss' || source.provider === 'custom') {
    return fetchRss(source, limit);
  }
  if (source.provider === 'gdelt') return fetchGdelt(source, limit);
  if (source.provider === 'hackernews') return fetchHackerNews(source, limit);
  if (source.provider === 'github') return fetchGitHubNews(source, limit);
  if (source.provider === 'newsapi') return fetchNewsApi(source, limit);
  throw new Error(`Unsupported intelligence provider: ${source.provider || source.type}`);
}
