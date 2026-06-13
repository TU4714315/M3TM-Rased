import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { exchangeServiceAccountCredentials } from './deploy-firestore-rules.mjs';

const API_ROOT = 'https://firestore.googleapis.com/v1';

export function indexRequest(index) {
  return {
    queryScope: index.queryScope || 'COLLECTION',
    fields: (index.fields || []).map((field) => ({
      fieldPath: field.fieldPath,
      ...(field.order ? { order: field.order } : {}),
      ...(field.arrayConfig ? { arrayConfig: field.arrayConfig } : {}),
    })),
  };
}

export async function deployFirestoreIndexes({
  projectId,
  accessToken,
  manifest,
  fetchImpl = fetch,
}) {
  if (!projectId || !accessToken || !manifest) {
    throw new Error('projectId, accessToken, and manifest are required.');
  }
  const results = [];
  for (const index of manifest.indexes || []) {
    const collectionGroup = encodeURIComponent(index.collectionGroup);
    const url = `${API_ROOT}/projects/${projectId}/databases/(default)/collectionGroups/${collectionGroup}/indexes`;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(indexRequest(index)),
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (response.status === 409) {
      results.push({ collectionGroup: index.collectionGroup, status: 'exists' });
      continue;
    }
    if (!response.ok) {
      throw new Error(
        body?.error?.message || `Firestore Indexes API returned ${response.status}.`,
      );
    }
    results.push({
      collectionGroup: index.collectionGroup,
      status: 'created',
      operation: body.name || '',
    });
  }
  return results;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  let accessToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (!accessToken) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required.');
    const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
    accessToken = await exchangeServiceAccountCredentials({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }
  const manifest = JSON.parse(await readFile('firestore.indexes.json', 'utf8'));
  const results = await deployFirestoreIndexes({ projectId, accessToken, manifest });
  for (const result of results) {
    console.log(`${result.collectionGroup}: ${result.status}`);
  }
}

const isEntrypoint =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) await main();
