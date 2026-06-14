import admin from 'firebase-admin';
import { pathToFileURL } from 'node:url';
import { buildArabicSeedSources } from './arabic-intelligence-sources.mjs';
import { toArabicIntelligenceItem } from './arabic-intelligence-lib.mjs';

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const PAGE_SIZE = 300;
const seedSources = new Map(buildArabicSeedSources().map((source) => [source.id, source]));

function sourceFor(item, storedSources) {
  const stored = storedSources.get(item.sourceId) || {};
  const seeded = seedSources.get(item.sourceId) || {};
  const fixedCategory = stored.source_type === 'gdelt_query'
    || stored.provider === 'github'
    || (stored.provider === 'gdelt' && Boolean(stored.query));
  return {
    ...stored,
    ...seeded,
    category_mode: seeded.category_mode
      || stored.category_mode
      || (fixedCategory ? 'fixed' : 'infer'),
  };
}

export async function repairIntelligenceNews({ dryRun = false } = {}) {
  const sourceSnapshot = await db.collection('news_sources').get();
  const sources = new Map(sourceSnapshot.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
  let cursor = null;
  let scanned = 0;
  let updated = 0;
  let archived = 0;
  let active = 0;

  while (true) {
    let query = db.collection('news_items').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const batch = db.batch();
    let writes = 0;

    for (const doc of snapshot.docs) {
      scanned += 1;
      const original = { id: doc.id, ...doc.data() };
      const source = sourceFor(original, sources);
      const repaired = toArabicIntelligenceItem(original, source);
      if (original.relevance_score != null && original.base_score == null) {
        repaired.base_score = Number(original.score || 25);
        repaired.score = Number(original.score || repaired.score);
      }
      if (repaired.status === 'archived') archived += 1;
      else active += 1;
      if (!dryRun) {
        batch.set(doc.ref, {
          title: repaired.title,
          url: repaired.url,
          category: repaired.category,
          subcategory: repaired.subcategory,
          country: repaired.country,
          region: repaired.region,
          summary_ar: repaired.summary_ar,
          contentSnippet_ar: repaired.contentSnippet_ar,
          tags_ar: repaired.tags_ar,
          importance: repaired.importance,
          risk_level: repaired.risk_level,
          confidence: repaired.confidence,
          sentiment: repaired.sentiment,
          score: repaired.score,
          base_score: repaired.base_score,
          relevance_score: repaired.relevance_score,
          status: repaired.status,
          entities: repaired.entities,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        writes += 1;
      }
    }

    if (writes) {
      await batch.commit();
      updated += writes;
    }
    cursor = snapshot.docs.at(-1);
    if (snapshot.size < PAGE_SIZE) break;
  }

  return { dryRun, scanned, updated, active, archived };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await repairIntelligenceNews({ dryRun: process.argv.includes('--dry-run') });
  console.log(JSON.stringify(result));
}
