import admin from 'firebase-admin';
import {
  assertPublicUrl,
  fetchFeed,
  fingerprint,
  parseFeed,
} from './feed-lib.mjs';

const serviceAccountValue = process.env.FIREBASE_SERVICE_ACCOUNT_M3TM_RASED;

if (!serviceAccountValue) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_M3TM_RASED is required.');
}

const serviceAccount = JSON.parse(serviceAccountValue);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function safePublishedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function syncSource(sourceDoc) {
  const source = { id: sourceDoc.id, ...sourceDoc.data() };
  const startedAt = admin.firestore.Timestamp.now();
  let fetched = 0;
  let inserted = 0;
  let skipped = 0;
  let status = 'success';
  let error = '';

  try {
    const xml = await fetchFeed(source.feedUrl);
    const items = parseFeed(xml).filter((item) => item.title);
    fetched = items.length;
    for (const item of items) {
      let url = '';
      try {
        url = item.url ? (await assertPublicUrl(item.url)).toString() : '';
      } catch {
        url = '';
      }
      const id = fingerprint([source.id, item.title, url]);
      const newsRef = db.collection('news').doc(id);
      const existing = await newsRef.get();
      if (existing.exists) {
        skipped += 1;
        continue;
      }
      await newsRef.create({
        title: item.title,
        sourceId: source.id,
        sourceName: source.name,
        url,
        category: source.category || 'عام',
        importance: 'low',
        summary: item.summary,
        fingerprint: id,
        publishedAt: admin.firestore.Timestamp.fromDate(safePublishedAt(item.publishedAt)),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'feed-sync',
      });
      inserted += 1;
    }
    await sourceDoc.ref.update({
      status: 'active',
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (caught) {
    status = 'failed';
    error = caught instanceof Error ? caught.message.slice(0, 500) : 'Unknown sync error';
    await sourceDoc.ref.update({
      status: 'error',
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: error,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await db.collection('syncRuns').add({
    sourceId: source.id,
    sourceName: source.name,
    status,
    fetched,
    inserted,
    skipped,
    error,
    startedAt,
    finishedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { source: source.name, status, fetched, inserted, skipped, error };
}

async function completePendingRequests() {
  const pending = await db.collection('syncRequests').where('status', '==', 'pending').limit(100).get();
  const batch = db.batch();
  pending.docs.forEach((request) => {
    batch.update(request.ref, {
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  if (!pending.empty) await batch.commit();
}

async function main() {
  const settingsSnapshot = await db.collection('settings').doc('general').get();
  if (settingsSnapshot.exists && settingsSnapshot.data().feedSyncEnabled === false) {
    console.log(JSON.stringify({ syncedAt: new Date().toISOString(), skipped: 'disabled' }, null, 2));
    return;
  }
  const sources = await db.collection('sources').where('status', 'in', ['active', 'error']).get();
  const results = [];
  for (const source of sources.docs) results.push(await syncSource(source));
  await completePendingRequests();
  console.log(JSON.stringify({ syncedAt: new Date().toISOString(), results }, null, 2));
}

if (process.env.NODE_ENV !== 'test') {
  await main();
}
