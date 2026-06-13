import { readFile } from 'node:fs/promises';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const allowedEmails = new Set([
  'moooom001@hotmail.com',
  'mohammed.e.z.m2@gmail.com',
]);

if (!projectId || !email || !allowedEmails.has(email)) {
  throw new Error('A configured BOOTSTRAP_ADMIN_EMAIL and FIREBASE_PROJECT_ID are required.');
}

const firebaseConfig = JSON.parse(await readFile('src/firebase-config.json', 'utf8'));
const app = initializeApp({ credential: applicationDefault(), projectId });
const adminAuth = getAuth(app);
const db = getFirestore(app);

let user = await adminAuth.getUserByEmail(email).catch((error) => {
  if (error?.code === 'auth/user-not-found') return null;
  throw error;
});

if (!user) {
  user = await adminAuth.createUser({
    email,
    emailVerified: false,
    displayName: email.split('@')[0],
    disabled: false,
  });
}

await db.doc(`users/${user.uid}`).set(
  {
    email,
    displayName: user.displayName || email.split('@')[0],
    role: 'admin',
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);

const response = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email,
    }),
  },
);
const body = await response.json();
if (!response.ok || body.email?.toLowerCase() !== email) {
  throw new Error(body?.error?.message || 'Firebase did not send the password setup email.');
}

console.log(
  JSON.stringify({
    email,
    authUser: 'active',
    profile: 'active-admin',
    passwordSetupEmail: 'sent',
  }),
);
