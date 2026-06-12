import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const API_ROOT = 'https://firebaserules.googleapis.com/v1';

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function apiRequest(url, accessToken, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  const body = await readJson(response);
  if (!response.ok) {
    const message = body?.error?.message || `Firebase Rules API returned ${response.status}.`;
    throw new Error(message);
  }
  return body;
}

export async function deployFirestoreRules({
  projectId,
  accessToken,
  rulesContent,
  fetchImpl = fetch,
}) {
  if (!projectId || !accessToken || !rulesContent) {
    throw new Error('projectId, accessToken, and rulesContent are required.');
  }

  const projectName = `projects/${projectId}`;
  const releaseName = `${projectName}/releases/cloud.firestore`;
  const ruleset = await apiRequest(
    `${API_ROOT}/${projectName}/rulesets`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        source: {
          files: [{ name: 'firestore.rules', content: rulesContent }],
        },
      }),
    },
    fetchImpl,
  );

  const releaseResponse = await fetchImpl(`${API_ROOT}/${releaseName}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (releaseResponse.status === 404) {
    await apiRequest(
      `${API_ROOT}/${projectName}/releases`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          name: releaseName,
          rulesetName: ruleset.name,
        }),
      },
      fetchImpl,
    );
  } else {
    const existingRelease = await readJson(releaseResponse);
    if (!releaseResponse.ok) {
      throw new Error(
        existingRelease?.error?.message ||
          `Firebase Rules API returned ${releaseResponse.status}.`,
      );
    }
    await apiRequest(
      `${API_ROOT}/${releaseName}`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify({
          release: {
            name: releaseName,
            rulesetName: ruleset.name,
          },
          updateMask: 'rulesetName',
        }),
      },
      fetchImpl,
    );
  }

  return { releaseName, rulesetName: ruleset.name };
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const accessToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  const rulesContent = await readFile('firestore.rules', 'utf8');
  const indexes = JSON.parse(await readFile('firestore.indexes.json', 'utf8'));

  if (indexes.indexes?.length || indexes.fieldOverrides?.length) {
    throw new Error(
      'Direct deployment currently requires an empty firestore.indexes.json manifest.',
    );
  }

  const result = await deployFirestoreRules({ projectId, accessToken, rulesContent });
  console.log(`Deployed ${result.rulesetName} to ${result.releaseName}.`);
}

const isEntrypoint =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  await main();
}
