import { describe, expect, it, vi } from 'vitest';
import { verifyFirebaseWebConfig } from '../scripts/verify-firebase-web-config.mjs';

const config = {
  apiKey: 'key',
  appId: 'app',
  authDomain: 'demo.firebaseapp.com',
  messagingSenderId: '123',
  projectId: 'demo',
  storageBucket: 'demo.firebasestorage.app',
};

describe('Firebase web config verification', () => {
  it('accepts a matching Firebase Hosting init config', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(config), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      verifyFirebaseWebConfig({
        localConfig: config,
        initUrl: 'https://demo.web.app/__/firebase/init.json',
        fetchImpl,
      }),
    ).resolves.toContain('apiKey');
  });

  it('rejects a stale API key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...config, apiKey: 'current-key' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      verifyFirebaseWebConfig({
        localConfig: config,
        initUrl: 'https://demo.web.app/__/firebase/init.json',
        fetchImpl,
      }),
    ).rejects.toThrow('apiKey');
  });
});
