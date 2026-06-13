import { randomBytes } from 'node:crypto';

import { chromium } from '@playwright/test';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const baseUrl = process.env.AUTH_SMOKE_BASE_URL || 'https://m3tm.app/';

if (!projectId) {
  throw new Error('FIREBASE_PROJECT_ID is required.');
}

const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}`;
const email = `codex-auth-smoke-${suffix}@example.com`;
const password = `M3tm!${randomBytes(18).toString('base64url')}`;
const app = initializeApp({ credential: applicationDefault(), projectId });
const adminAuth = getAuth(app);
const db = getFirestore(app);
let uid = null;
let browser;

try {
  await db.doc(`invites/${email}`).set({
    email,
    role: 'user',
    status: 'pending',
    createdBy: 'production-auth-smoke',
    createdAt: FieldValue.serverTimestamp(),
  });

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const cspFailures = [];
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText === 'csp') {
      cspFailures.push(request.url());
    }
  });

  await page.goto(`${baseUrl}?auth-smoke=${suffix}`, { waitUntil: 'networkidle' });

  const popupPromise = context.waitForEvent('page', { timeout: 15_000 });
  await page.locator('#google-login').click();
  const popup = await popupPromise;
  await popup.waitForURL(/^https:\/\/accounts\.google\.com\//, { timeout: 20_000 });
  await popup.close();

  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#register-invited').click();
  await page.getByRole('heading', { name: 'لوحة الرصد' }).waitFor({
    state: 'visible',
    timeout: 30_000,
  });

  const user = await adminAuth.getUserByEmail(email);
  uid = user.uid;
  const [profileSnapshot, inviteSnapshot] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`invites/${email}`).get(),
  ]);
  const profile = profileSnapshot.data();
  const invite = inviteSnapshot.data();

  if (!profileSnapshot.exists || profile?.role !== 'user' || profile?.active !== true) {
    throw new Error('Invited registration did not create an active user profile.');
  }
  if (!inviteSnapshot.exists || invite?.status !== 'accepted') {
    throw new Error('Invited registration did not accept the invite.');
  }
  if (cspFailures.length) {
    throw new Error(`CSP blocked authentication resources: ${cspFailures.join(', ')}`);
  }

  console.log(
    JSON.stringify(
      {
        googlePopup: 'accounts.google.com',
        invitedRegistration: 'passed',
        role: profile.role,
        inviteStatus: invite.status,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  if (!uid) {
    uid = await adminAuth
      .getUserByEmail(email)
      .then((user) => user.uid)
      .catch(() => null);
  }
  await Promise.allSettled([
    uid ? adminAuth.deleteUser(uid) : Promise.resolve(),
    uid ? db.doc(`users/${uid}`).delete() : Promise.resolve(),
    db.doc(`invites/${email}`).delete(),
  ]);
}
