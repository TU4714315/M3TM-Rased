const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/i,
];

export function safeHttpUrl(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('يسمح فقط بروابط HTTP وHTTPS.');
  }
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    throw new Error('العناوين المحلية والخاصة غير مسموحة.');
  }
  return url.toString();
}

export function cleanText(value: unknown, maxLength = 500): string {
  return [...String(value ?? '')]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? ' ' : character;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export async function fingerprint(parts: string[]): Promise<string> {
  const normalized = parts.map((part) => cleanText(part).toLowerCase()).join('|');
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
