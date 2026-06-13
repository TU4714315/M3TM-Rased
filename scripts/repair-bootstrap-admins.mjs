import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const bootstrapAdminEmails = [
  'moooom001@hotmail.com',
  'mohammed.e.z.m2@gmail.com',
];

if (!projectId) {
  throw new Error('FIREBASE_PROJECT_ID is required.');
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const adminAuth = getAuth(app);
const db = getFirestore(app);
const results = [];

for (const email of bootstrapAdminEmails) {
  const user = await adminAuth.getUserByEmail(email).catch((error) => {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  });

  if (!user) {
    results.push({
      email,
      authUser: 'missing',
      profile: 'not-applicable',
    });
    continue;
  }

  const profileRef = db.doc(`users/${user.uid}`);
  const profileSnapshot = await profileRef.get();
  const profile = profileSnapshot.data();
  const needsRepair =
    !profileSnapshot.exists ||
    profile?.email !== email ||
    profile?.role !== 'admin' ||
    profile?.active !== true;

  if (needsRepair) {
    await profileRef.set(
      {
        email,
        displayName: user.displayName || email.split('@')[0],
        role: 'admin',
        active: true,
        createdAt: profile?.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  results.push({
    email,
    authUser: user.disabled ? 'disabled' : 'active',
    providers: user.providerData.map(({ providerId }) => providerId).sort(),
    profile: needsRepair ? 'repaired' : 'active-admin',
  });
}

console.log(JSON.stringify(results, null, 2));
