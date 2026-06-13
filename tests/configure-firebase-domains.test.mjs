import { describe, expect, it, vi } from 'vitest';

import {
  ensureAuthorizedDomains,
  ensureCustomDomain,
  getCustomDomain,
  summarizeCustomDomain,
} from '../scripts/configure-firebase-domains.mjs';

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

describe('Firebase domain configuration', () => {
  it('returns an existing custom domain without creating another one', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response(200, {
        name: 'projects/demo/sites/demo/customDomains/m3tm.app',
        hostState: 'HOST_MISMATCH',
      }),
    );

    const result = await ensureCustomDomain({
      projectId: 'demo',
      siteId: 'demo',
      domain: 'm3tm.app',
      accessToken: 'token',
      fetchImpl,
    });

    expect(result.created).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('creates a missing redirect domain with the expected target', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(404, { error: { message: 'Not found' } }))
      .mockResolvedValueOnce(response(200, { name: 'operations/create-www' }));

    const result = await ensureCustomDomain({
      projectId: 'demo',
      siteId: 'demo',
      domain: 'www.m3tm.app',
      redirectTarget: 'm3tm.app',
      accessToken: 'token',
      fetchImpl,
    });

    expect(result.created).toBe(true);
    expect(fetchImpl.mock.calls[1][0]).toContain('customDomainId=www.m3tm.app');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      redirectTarget: 'm3tm.app',
    });
  });

  it('adds missing Firebase Auth domains without removing existing entries', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, {
          authorizedDomains: ['demo.firebaseapp.com', 'localhost'],
        }),
      )
      .mockResolvedValueOnce(
        response(200, {
          authorizedDomains: [
            'demo.firebaseapp.com',
            'localhost',
            'm3tm.app',
            'www.m3tm.app',
          ],
        }),
      );

    const result = await ensureAuthorizedDomains({
      projectId: 'demo',
      domains: ['m3tm.app', 'www.m3tm.app'],
      accessToken: 'token',
      fetchImpl,
    });

    expect(result.updated).toBe(true);
    expect(fetchImpl.mock.calls[1][0]).toContain('updateMask=authorizedDomains');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).authorizedDomains).toContain('localhost');
  });

  it('rejects malformed domains before making a request', async () => {
    const fetchImpl = vi.fn();

    await expect(
      getCustomDomain({
        projectId: 'demo',
        siteId: 'demo',
        domain: 'https://m3tm.app',
        accessToken: 'token',
        fetchImpl,
      }),
    ).rejects.toThrow('Invalid domain');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('summarizes operational state without adding credentials', () => {
    expect(
      summarizeCustomDomain({
        name: 'projects/demo/sites/demo/customDomains/m3tm.app',
        ownershipState: 'OWNERSHIP_MISSING',
        requiredDnsUpdates: { desired: [{ records: [{ type: 'TXT' }] }] },
      }),
    ).toEqual(
      expect.objectContaining({
        ownershipState: 'OWNERSHIP_MISSING',
        requiredDnsUpdates: expect.any(Object),
      }),
    );
  });
});
