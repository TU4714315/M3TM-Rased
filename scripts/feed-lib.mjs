import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { XMLParser } from 'fast-xml-parser';
import ipaddr from 'ipaddr.js';

export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 12_000;
export const MAX_REDIRECTS = 3;
export const MAX_ITEMS_PER_SOURCE = 100;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false,
  processEntities: false,
});

function array(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function text(value) {
  if (value == null) return '';
  if (typeof value === 'object') return String(value['#text'] ?? value['@_href'] ?? '').trim();
  return String(value).replace(/\s+/g, ' ').trim();
}

export function limitedText(value, maxLength) {
  return text(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function fingerprint(parts) {
  return createHash('sha256').update(parts.map((part) => text(part).toLowerCase()).join('|')).digest('hex');
}

export function isPublicAddress(address) {
  const parsed = ipaddr.parse(address);
  return parsed.range() === 'unicast';
}

export async function assertPublicUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol.');
  if (url.username || url.password) throw new Error('Credentials in URLs are not allowed.');
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Private or non-routable feed address is not allowed.');
  }
  return url;
}

export async function fetchFeed(urlValue, redirects = 0, options = {}) {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? MAX_RESPONSE_BYTES;
  const url = await assertPublicUrl(urlValue);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9',
        'user-agent': 'M3TM-RASED-FeedSync/1.0',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= MAX_REDIRECTS) throw new Error('Too many redirects.');
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without location.');
      return fetchFeed(new URL(location, url).toString(), redirects + 1, options);
    }
    if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}.`);
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > maxResponseBytes) throw new Error('Feed response is too large.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Feed response has no body.');
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxResponseBytes) {
        await reader.cancel();
        throw new Error('Feed response exceeded the size limit.');
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  } finally {
    clearTimeout(timeout);
  }
}

function atomLink(entry) {
  const links = array(entry.link);
  const preferred = links.find((link) => link?.['@_rel'] === 'alternate') ?? links[0];
  return text(preferred);
}

export function parseFeed(xml) {
  const document = parser.parse(xml);
  const rssItems = array(document?.rss?.channel?.item);
  if (rssItems.length) {
    return rssItems.slice(0, MAX_ITEMS_PER_SOURCE).map((item) => ({
      title: limitedText(item.title, 180),
      url: text(item.link || item.guid),
      summary: limitedText(item.description || item['content:encoded'], 2000),
      publishedAt: text(item.pubDate || item.date),
    }));
  }
  const atomEntries = array(document?.feed?.entry);
  if (atomEntries.length) {
    return atomEntries.slice(0, MAX_ITEMS_PER_SOURCE).map((entry) => ({
      title: limitedText(entry.title, 180),
      url: atomLink(entry),
      summary: limitedText(entry.summary || entry.content, 2000),
      publishedAt: text(entry.published || entry.updated),
    }));
  }
  throw new Error('The document is not a supported RSS or Atom feed.');
}
