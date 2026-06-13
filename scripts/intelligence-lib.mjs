import { createHash } from 'node:crypto';

export const DEFAULT_CATEGORIES = [
  'Cybersecurity',
  'Artificial Intelligence',
  'OSINT',
  'Cloud',
  'Google Cloud',
  'Firebase',
  'Firestore',
  'Cloud Run',
  'GitHub',
  'Open-source tools',
  'Saudi Arabia',
  'Business',
  'Government / regulation',
  'Threat intelligence',
  'Data leaks',
  'CVE / vulnerabilities',
  'Automation',
  'Telegram bots',
  'APIs',
];

export const DEFAULT_KEYWORDS = [
  'osint',
  'open source intelligence',
  'ai agents',
  'llm',
  'agentic workflow',
  'automation',
  'google cloud',
  'cloud run',
  'firestore',
  'firebase',
  'secret manager',
  'telegram bot',
  'github',
  'repository',
  'cve',
  'exploit',
  'vulnerability',
  'ransomware',
  'malware',
  'breach',
  'leak',
  'threat intelligence',
  'data exposure',
  'api security',
  'saudi arabia',
  'digital government',
  'cybersecurity regulation',
];

const CATEGORY_TERMS = new Map([
  ['Cybersecurity', ['cyber', 'security', 'ransomware', 'malware', 'breach', 'exploit']],
  ['Artificial Intelligence', ['artificial intelligence', ' ai ', 'llm', 'agentic', 'machine learning']],
  ['OSINT', ['osint', 'open source intelligence', 'investigation']],
  ['Cloud', ['cloud', 'cloud run', 'firestore', 'firebase', 'aws', 'azure']],
  ['GitHub', ['github', 'repository', 'open source']],
  ['Saudi Arabia', ['saudi', 'ksa', 'السعودية', 'الرياض']],
  ['CVE / vulnerabilities', ['cve-', 'vulnerability', 'zero-day', 'exploit']],
  ['Threat intelligence', ['threat intelligence', 'ioc', 'apt', 'campaign']],
  ['Automation', ['automation', 'workflow', 'bot', 'api']],
]);

const TECHNOLOGIES = [
  'FastAPI',
  'Firebase',
  'Firestore',
  'Cloud Run',
  'Google Cloud',
  'AWS',
  'Azure',
  'OpenAI',
  'Telegram',
  'GitHub',
  'Docker',
  'Kubernetes',
  'Python',
  'TypeScript',
  'MISP',
  'OpenCTI',
  'SpiderFoot',
  'GDELT',
];

function clean(value, max = 10_000) {
  return [...String(value ?? '')]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? ' ' : character;
    })
    .join('')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function normalizeTitle(value) {
  return clean(value, 240)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function intelligenceHash(parts) {
  return createHash('sha256')
    .update(parts.map((part) => clean(part).toLowerCase()).join('|'))
    .digest('hex');
}

function uniqueMatches(text, expression, mapper = (match) => match[0]) {
  return [...new Set([...text.matchAll(expression)].map(mapper).filter(Boolean))].slice(0, 50);
}

export function extractEntities(input) {
  const text = clean(input, 50_000);
  const urls = uniqueMatches(text, /https?:\/\/[^\s<>"']+/gi, (match) =>
    match[0].replace(/[),.;]+$/, ''),
  );
  const domains = [
    ...new Set(
      urls
        .map((value) => {
          try {
            return new URL(value).hostname.toLowerCase();
          } catch {
            return '';
          }
        })
        .filter(Boolean),
    ),
  ];
  const technologies = TECHNOLOGIES.filter((name) =>
    new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text),
  );
  const countries = ['Saudi Arabia', 'United States', 'China', 'Russia', 'Ukraine', 'Israel']
    .filter((name) => text.toLowerCase().includes(name.toLowerCase()));
  return {
    people: [],
    organizations: [],
    countries,
    domains,
    urls,
    emails: uniqueMatches(text, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi),
    ipAddresses: uniqueMatches(
      text,
      /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g,
    ),
    cves: uniqueMatches(text, /\bCVE-\d{4}-\d{4,7}\b/gi, (match) => match[0].toUpperCase()),
    githubRepos: uniqueMatches(
      text,
      /github\.com\/([A-Z0-9_.-]+\/[A-Z0-9_.-]+)/gi,
      (match) => match[1]?.replace(/[),.;]+$/, '').replace(/\.git$/i, '') ?? '',
    ),
    technologies,
    cloudProducts: technologies.filter((name) =>
      ['Firebase', 'Firestore', 'Cloud Run', 'Google Cloud', 'AWS', 'Azure'].includes(name),
    ),
  };
}

export function inferCategory(input, fallback = 'General') {
  const text = ` ${clean(input).toLowerCase()} `;
  let best = fallback;
  let bestCount = 0;
  for (const [category, terms] of CATEGORY_TERMS) {
    const count = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

export function scoreIntelligenceItem(item, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const published = new Date(item.publishedAt || now);
  const ageHours = Math.max(0, (now.getTime() - published.getTime()) / 3_600_000);
  const text = `${item.title ?? ''} ${item.summary ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase();
  const relevance = DEFAULT_KEYWORDS.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0);
  const security = ['cve-', 'zero-day', 'ransomware', 'breach', 'exploit', 'vulnerability']
    .reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0);
  const strategic = ['osint', 'ai agent', 'llm', 'threat intelligence', 'cloud run', 'firestore']
    .reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0);
  const regional = ['saudi', 'ksa', 'السعودية'].some((keyword) => text.includes(keyword)) ? 8 : 0;
  const sourcePriority = Math.max(0, Math.min(100, Number(options.sourcePriority ?? 50))) * 0.2;
  const recency = ageHours <= 6 ? 20 : ageHours <= 24 ? 15 : ageHours <= 72 ? 10 : ageHours <= 168 ? 5 : 0;
  const repository = item.provider === 'github'
    ? Math.min(15, Math.log10(Math.max(1, Number(item.stars ?? 0))) * 5)
    : 0;
  return Math.round(
    Math.max(
      0,
      Math.min(100, sourcePriority + recency + Math.min(24, relevance * 4) + Math.min(20, security * 5) + Math.min(13, strategic * 3) + regional + repository),
    ),
  );
}

export function normalizeNewsItem(raw, source = {}) {
  const title = clean(raw.title, 240);
  const url = clean(raw.url, 2048);
  const summary = clean(raw.summary || raw.description, 4000);
  const contentSnippet = clean(raw.contentSnippet || raw.content || summary, 2000);
  const publishedAt = new Date(raw.publishedAt || raw.published_at || raw.date || Date.now());
  const safePublishedAt = Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt;
  const provider = source.provider || raw.provider || 'custom';
  const category = source.category || raw.category || inferCategory(`${title} ${summary}`);
  const entities = extractEntities(`${title} ${summary} ${url}`);
  const tags = [
    ...new Set([
      category,
      ...entities.cves,
      ...entities.technologies,
      ...(Array.isArray(raw.tags) ? raw.tags.map((tag) => clean(tag, 80)) : []),
    ]),
  ].filter(Boolean).slice(0, 30);
  const hash = intelligenceHash([url || normalizeTitle(title), normalizeTitle(title)]);
  const item = {
    id: hash,
    title,
    url,
    source: clean(source.name || raw.source || provider, 160),
    sourceId: source.id || '',
    provider,
    category,
    language: clean(source.language || raw.language || 'en', 12),
    summary,
    contentSnippet,
    author: clean(raw.author, 160),
    imageUrl: clean(raw.imageUrl || raw.image, 2048),
    publishedAt: safePublishedAt,
    fetchedAt: new Date(),
    tags,
    entities,
    hash,
    rawPayload: raw.rawPayload || {},
    status: 'active',
  };
  return {
    ...item,
    score: scoreIntelligenceItem(
      { ...item, stars: raw.stars },
      { sourcePriority: source.priority ?? 50 },
    ),
  };
}

export function titleSimilarity(left, right) {
  const a = new Set(normalizeTitle(left).split(' ').filter((word) => word.length > 2));
  const b = new Set(normalizeTitle(right).split(' ').filter((word) => word.length > 2));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / (a.size + b.size - intersection);
}

export function isDuplicate(candidate, existing) {
  return existing.some(
    (item) =>
      (candidate.url && item.url === candidate.url) ||
      item.hash === candidate.hash ||
      normalizeTitle(item.title) === normalizeTitle(candidate.title) ||
      titleSimilarity(item.title, candidate.title) >= 0.9,
  );
}

export function matchWatchlist(item, watchlist) {
  if (!watchlist.enabled) return null;
  const text = clean(
    `${item.title ?? ''} ${item.summary ?? ''} ${item.description ?? ''} ${(item.tags ?? []).join(' ')}`,
  ).toLowerCase();
  const candidates = [...(watchlist.keywords ?? []), ...(watchlist.entities ?? [])]
    .map((value) => clean(value, 120).toLowerCase())
    .filter(Boolean);
  const matchedKeywords = [...new Set(candidates.filter((value) => text.includes(value)))];
  if (!matchedKeywords.length) return null;
  return {
    matchedText: clean(`${item.title ?? item.fullName ?? ''} ${item.summary ?? item.description ?? ''}`, 500),
    matchedKeywords,
    score: Math.min(100, 45 + matchedKeywords.length * 12 + Math.round(Number(item.score ?? 0) * 0.25)),
  };
}

export function extractRepositoryIdeas(repo) {
  const text = `${repo.name ?? ''} ${repo.description ?? ''} ${(repo.topics ?? []).join(' ')}`.toLowerCase();
  const ideas = [];
  if (/osint|investigation|maltego|spiderfoot/.test(text)) ideas.push('إضافة مساحة تحقيق تربط الكيانات والأدلة والمصادر.');
  if (/threat|misp|opencti|cve|vulnerab/.test(text)) ideas.push('إضافة خط زمني لمؤشرات التهديد والثغرات مع درجة خطورة.');
  if (/rss|news|gdelt|feed/.test(text)) ideas.push('تحسين تجميع الأخبار بالتصفية الدلالية وإزالة التكرار.');
  if (/agent|llm|ai/.test(text)) ideas.push('إضافة مساعد تحليلي يولد ملخصات وأسئلة متابعة قابلة للتدقيق.');
  if (/telegram|bot/.test(text)) ideas.push('إضافة قناة تنبيهات Telegram بقواعد اشتراك منفصلة.');
  if (/dashboard|visual|graph/.test(text)) ideas.push('إضافة لوحات مؤشرات ورسوم علاقات قابلة للتصفية.');
  return ideas.length ? ideas.slice(0, 5) : ['مراجعة البنية والواجهة لاستخلاص نمط قابل لإعادة الاستخدام دون نسخ الشفرة.'];
}
