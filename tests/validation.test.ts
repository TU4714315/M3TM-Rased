import { describe, expect, it } from 'vitest';
import { cleanText, fingerprint, safeHttpUrl } from '../src/lib/validation';

describe('validation', () => {
  it('accepts public HTTP and HTTPS URLs', () => {
    expect(safeHttpUrl('https://example.com/feed.xml')).toBe('https://example.com/feed.xml');
  });

  it('rejects local addresses and unsafe protocols', () => {
    expect(() => safeHttpUrl('http://127.0.0.1/feed')).toThrow();
    expect(() => safeHttpUrl('javascript:alert(1)')).toThrow();
  });

  it('cleans and limits text', () => {
    expect(cleanText('  hello\u0000   world  ', 20)).toBe('hello world');
  });

  it('creates stable fingerprints', async () => {
    expect(await fingerprint(['Title', 'https://example.com'])).toBe(
      await fingerprint([' title ', 'HTTPS://EXAMPLE.COM']),
    );
  });
});
