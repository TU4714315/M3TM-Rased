import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { isBootstrapAdmin, normalizeEmail } from './permissions';
import type { Invite, Role, UserProfile } from '../types';

export interface Session {
  user: User | null;
  profile: UserProfile | null;
  blockedReason: string | null;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function profileFromData(id: string, data: DocumentData): UserProfile {
  return { id, ...(data as Omit<UserProfile, 'id'>) };
}

async function claimProfile(user: User): Promise<UserProfile | null> {
  if (!user.email) return null;
  const email = normalizeEmail(user.email);
  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) return profileFromData(existing.id, existing.data());

  const bootstrapRole: Role | null = isBootstrapAdmin(email) ? 'admin' : null;
  const inviteRef = doc(db, 'invites', email);

  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(userRef);
    if (current.exists()) return profileFromData(current.id, current.data());

    const inviteSnapshot = await transaction.get(inviteRef);
    const invite = inviteSnapshot.exists() ? (inviteSnapshot.data() as Invite) : null;
    const role = bootstrapRole ?? (invite?.status === 'pending' ? invite.role : null);
    if (!role) return null;

    const now = serverTimestamp();
    const profile = {
      email,
      displayName: user.displayName || email.split('@')[0] || 'مستخدم',
      role,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    transaction.set(userRef, profile);
    if (invite && inviteSnapshot.exists()) {
      transaction.update(inviteRef, { status: 'accepted', acceptedAt: now });
    }
    return { id: user.uid, ...profile } as unknown as UserProfile;
  });
}

export function observeSession(callback: (session: Session) => void): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback({ user: null, profile: null, blockedReason: null });
      return;
    }
    try {
      const profile = await claimProfile(user);
      if (!profile || !profile.active) {
        callback({
          user,
          profile: null,
          blockedReason: 'هذا الحساب غير مدعو أو تم تعطيله. تواصل مع مدير النظام.',
        });
        return;
      }
      callback({ user, profile, blockedReason: null });
    } catch (error) {
      callback({
        user,
        profile: null,
        blockedReason: error instanceof Error ? error.message : 'تعذر التحقق من الصلاحية.',
      });
    }
  });
}

export async function loginWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
}

export async function registerInvitedUser(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
}

export async function logout(): Promise<void> {
  await signOut(auth);
}
