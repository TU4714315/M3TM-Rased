import { describe, expect, it } from 'vitest';
import { fingerprint, isPublicAddress, parseFeed } from '../scripts/feed-lib.mjs';

describe('feed parser', () => {
  it('parses RSS items', () => {
    const items = parseFeed(`<?xml version="1.0"?>
      <rss version="2.0"><channel><item>
        <title>خبر تجريبي</title>
        <link>https://example.com/news/1</link>
        <description><![CDATA[<p>ملخص الخبر</p>]]></description>
        <pubDate>Sun, 07 Jun 2026 10:00:00 GMT</pubDate>
      </item></channel></rss>`);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('خبر تجريبي');
    expect(items[0].summary).toBe('ملخص الخبر');
  });

  it('parses Atom entries and alternate links', () => {
    const items = parseFeed(`<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom"><entry>
        <title>Atom item</title>
        <link rel="alternate" href="https://example.com/atom/1" />
        <summary>Summary</summary><updated>2026-06-07T10:00:00Z</updated>
      </entry></feed>`);
    expect(items[0].url).toBe('https://example.com/atom/1');
  });

  it('rejects unsupported XML and classifies private addresses', () => {
    expect(() => parseFeed('<root />')).toThrow();
    expect(isPublicAddress('127.0.0.1')).toBe(false);
    expect(isPublicAddress('10.0.0.1')).toBe(false);
    expect(isPublicAddress('8.8.8.8')).toBe(true);
  });

  it('deduplicates with a stable fingerprint', () => {
    expect(fingerprint(['A', 'B'])).toBe(fingerprint([' a ', 'b']));
  });
});
