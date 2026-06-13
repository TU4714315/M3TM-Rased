import { describe, expect, it, vi } from 'vitest';
import { assertPublicUrl, fetchFeed } from '../scripts/feed-lib.mjs';
import { withRetry } from '../scripts/provider-client.mjs';

describe('provider transport security', () => {
  it('rejects loopback and cloud metadata addresses', async () => {
    await expect(assertPublicUrl('http://127.0.0.1/feed')).rejects.toThrow(/Private|non-routable/);
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(
      /Private|non-routable/,
    );
  });

  it('enforces response size limits', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () =>
      new Response('x'.repeat(100), {
        status: 200,
        headers: { 'content-length': '100' },
      }),
    );
    try {
      await expect(
        fetchFeed('https://example.com/feed.xml', 0, { maxResponseBytes: 10, timeoutMs: 500 }),
      ).rejects.toThrow(/too large/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('retries transient provider failures with backoff', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      if (calls < 3) throw new Error('temporary');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });
});
