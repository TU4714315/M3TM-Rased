import { describe, expect, it, vi } from 'vitest';
import { deployFirestoreRules } from '../scripts/deploy-firestore-rules.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Firestore Rules API deployment', () => {
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
