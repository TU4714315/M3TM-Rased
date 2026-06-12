import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '8.8.8.8', family: 4 }]),
}));

const { fetchFeed } = await import('../scripts/feed-lib.mjs');

describe('safe feed fetching', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows a bounded public redirect', async () => {
    const mockedFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: 'https://example.com/final.xml' } }),
      )
      .mockResolvedValueOnce(new Response('<rss><channel /></rss>', { status: 200 }));
    vi.stubGlobal('fetch', mockedFetch);
    await expect(fetchFeed('https://example.com/start.xml')).resolves.toContain('<rss>');
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('rejects oversized responses before reading the body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('large', {
          status: 200,
          headers: { 'content-length': '5000' },
        }),
      ),
    );
    await expect(
      fetchFeed('https://example.com/feed.xml', 0, { maxResponseBytes: 100 }),
    ).rejects.toThrow('too large');
  });

  it('aborts requests that exceed the configured timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );
    await expect(
      fetchFeed('https://example.com/slow.xml', 0, { timeoutMs: 5 }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
