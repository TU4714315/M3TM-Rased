import { readFile } from 'node:fs/promises';
import { createSign } from 'node:crypto';
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

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export async function exchangeServiceAccountCredentials({
  credentials,
  fetchImpl = fetch,
  now = Date.now(),
}) {
  if (!credentials?.client_email || !credentials?.private_key) {
    throw new Error('Service account credentials are incomplete.');
  }

  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const issuedAt = Math.floor(now / 1000);
  const unsignedToken = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/firebase',
    aud: tokenUri,
    iat: issuedAt,
    exp: issuedAt + 3600,
  })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const assertion = `${unsignedToken}.${signer.sign(credentials.private_key, 'base64url')}`;
  const response = await fetchImpl(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = await readJson(response);

  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || 'Google OAuth token exchange failed.');
  }
  return body.access_token;
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
  let accessToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (!accessToken) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required.');
    }
    const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
    accessToken = await exchangeServiceAccountCredentials({ credentials });
  }
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
