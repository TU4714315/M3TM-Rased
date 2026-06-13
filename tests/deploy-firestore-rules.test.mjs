import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  deployFirestoreRules,
  exchangeServiceAccountCredentials,
} from '../scripts/deploy-firestore-rules.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Firestore Rules API deployment', () => {
  it('exchanges a signed service-account JWT for a short-lived token', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({ access_token: 'token' }));

    await expect(
      exchangeServiceAccountCredentials({
        credentials: {
          client_email: 'firebase@example.iam.gserviceaccount.com',
          private_key: privateKey,
          token_uri: 'https://oauth2.googleapis.com/token',
        },
        fetchImpl,
        now: 1_700_000_000_000,
      }),
    ).resolves.toBe('token');

    const request = fetchImpl.mock.calls[0];
    expect(request[0]).toBe('https://oauth2.googleapis.com/token');
    expect(String(request[1].body)).toContain(
      'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer',
    );
    expect(String(request[1].body)).not.toContain(privateKey);
  });

  it('includes explicitly requested OAuth scopes in the signed assertion', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({ access_token: 'token' }));

    await exchangeServiceAccountCredentials({
      credentials: {
        client_email: 'firebase@example.iam.gserviceaccount.com',
        private_key: privateKey,
      },
      scopes: ['scope-a', 'scope-b'],
      fetchImpl,
      now: 1_700_000_000_000,
    });

    const body = new URLSearchParams(String(fetchImpl.mock.calls[0][1].body));
    const assertion = body.get('assertion');
    const claims = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString());
    expect(claims.scope).toBe('scope-a scope-b');
  });

  it('updates the existing Firestore release', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ name: 'projects/demo/rulesets/new-rules' }))
      .mockResolvedValueOnce(
        jsonResponse({
          name: 'projects/demo/releases/cloud.firestore',
          rulesetName: 'projects/demo/rulesets/old-rules',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          name: 'projects/demo/releases/cloud.firestore',
          rulesetName: 'projects/demo/rulesets/new-rules',
        }),
      );

    await expect(
      deployFirestoreRules({
        projectId: 'demo',
        accessToken: 'token',
        rulesContent: 'rules_version = "2";',
        fetchImpl,
      }),
    ).resolves.toEqual({
      releaseName: 'projects/demo/releases/cloud.firestore',
      rulesetName: 'projects/demo/rulesets/new-rules',
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://firebaserules.googleapis.com/v1/projects/demo/releases/cloud.firestore',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('creates the Firestore release when it does not exist', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ name: 'projects/demo/rulesets/new-rules' }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'Not found' } }, 404))
      .mockResolvedValueOnce(
        jsonResponse({
          name: 'projects/demo/releases/cloud.firestore',
          rulesetName: 'projects/demo/rulesets/new-rules',
        }),
      );

    await deployFirestoreRules({
      projectId: 'demo',
      accessToken: 'token',
      rulesContent: 'rules_version = "2";',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://firebaserules.googleapis.com/v1/projects/demo/releases',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('surfaces API errors without exposing the access token', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse({ error: { message: 'Missing rules permission' } }, 403),
    );

    const deployment = deployFirestoreRules({
      projectId: 'demo',
      accessToken: 'secret-token',
      rulesContent: 'rules_version = "2";',
      fetchImpl,
    });

    const error = await deployment.catch((caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Missing rules permission');
    expect(error.message).not.toContain('secret-token');
  });
});
