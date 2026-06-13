import { describe, expect, it, vi } from 'vitest';
import {
  deployFirestoreIndexes,
  indexRequest,
} from '../scripts/deploy-firestore-indexes.mjs';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Firestore index deployment', () => {
  it('maps Firebase index manifests to Firestore Admin API payloads', () => {
    expect(indexRequest({
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'category', order: 'ASCENDING' },
        { fieldPath: 'publishedAt', order: 'DESCENDING' },
      ],
    })).toEqual({
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'category', order: 'ASCENDING' },
        { fieldPath: 'publishedAt', order: 'DESCENDING' },
      ],
    });
  });

  it('creates missing indexes and tolerates existing indexes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({ name: 'operations/index-1' }))
      .mockResolvedValueOnce(response({ error: { message: 'Already exists' } }, 409));
    const manifest = {
      indexes: [
        {
          collectionGroup: 'news_items',
          queryScope: 'COLLECTION',
          fields: [{ fieldPath: 'score', order: 'DESCENDING' }],
        },
        {
          collectionGroup: 'watchlists',
          queryScope: 'COLLECTION',
          fields: [{ fieldPath: 'updatedAt', order: 'DESCENDING' }],
        },
      ],
    };
    await expect(deployFirestoreIndexes({
      projectId: 'demo',
      accessToken: 'token',
      manifest,
      fetchImpl,
    })).resolves.toEqual([
      { collectionGroup: 'news_items', status: 'created', operation: 'operations/index-1' },
      { collectionGroup: 'watchlists', status: 'exists' },
    ]);
  });

  it('surfaces Firestore API errors without exposing the token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({ error: { message: 'Missing datastore.indexes.create' } }, 403),
    );
    const error = await deployFirestoreIndexes({
      projectId: 'demo',
      accessToken: 'secret-token',
      manifest: {
        indexes: [{
          collectionGroup: 'news_items',
          fields: [{ fieldPath: 'score', order: 'DESCENDING' }],
        }],
      },
      fetchImpl,
    }).catch((caught) => caught);
    expect(error.message).toBe('Missing datastore.indexes.create');
    expect(error.message).not.toContain('secret-token');
  });
});
