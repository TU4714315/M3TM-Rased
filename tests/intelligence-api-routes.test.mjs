import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const requiredRoutes = [
  '/news',
  '/news/sources/seed-arabic',
  '/news/fetch-arabic',
  '/news/arabic-dashboard',
  '/news/fetch-logs',
  '/news/stats',
  '/grey-intel',
  '/grey-intel/sources/seed',
  '/grey-intel/fetch',
  '/grey-intel/dashboard',
  '/grey-intel/watchlist/check',
  '/repos/intelligence',
  '/repos/search',
  '/watchlists',
  '/alerts',
  '/alerts/read-all',
  '/reports/intelligence',
  '/reports/arabic-brief',
  '/reports/grey-intel',
];

describe('Arabic intelligence API surface', () => {
  it('contains the documented operational routes', async () => {
    const source = await readFile('server/index.mjs', 'utf8');
    for (const route of requiredRoutes) expect(source).toContain(route);
  });

  it('protects seed and fetch operations with administrator checks', async () => {
    const source = await readFile('server/index.mjs', 'utf8');
    for (const route of [
      '/news/sources/seed-arabic',
      '/news/fetch-arabic',
      '/grey-intel/sources/seed',
      '/grey-intel/fetch',
    ]) {
      const offset = source.indexOf(route);
      expect(offset).toBeGreaterThan(0);
      expect(source.slice(offset, offset + 350)).toContain("requireRole(user, ['admin'])");
    }
  });
});
