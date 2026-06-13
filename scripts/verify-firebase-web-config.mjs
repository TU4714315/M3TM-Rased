import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const CONFIG_FIELDS = [
  'apiKey',
  'appId',
  'authDomain',
  'messagingSenderId',
  'projectId',
  'storageBucket',
];

export async function verifyFirebaseWebConfig({
  localConfig,
  initUrl,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(initUrl, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Firebase init config returned HTTP ${response.status}.`);
  }

  const remoteConfig = await response.json();
  const mismatches = CONFIG_FIELDS.filter(
    (field) => localConfig[field] !== remoteConfig[field],
  );
  if (mismatches.length) {
    throw new Error(`Firebase web config mismatch: ${mismatches.join(', ')}.`);
  }

  return CONFIG_FIELDS;
}

async function main() {
  const localConfig = JSON.parse(await readFile('src/firebase-config.json', 'utf8'));
  const initUrl =
    process.env.FIREBASE_INIT_URL ||
    'https://m3tm-rased-07246627-7b0bf.web.app/__/firebase/init.json';
  const fields = await verifyFirebaseWebConfig({ localConfig, initUrl });
  console.log(`Firebase web config verified (${fields.join(', ')}).`);
}

const isEntrypoint =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  await main();
}
