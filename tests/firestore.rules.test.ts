import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'm3tm-rules-test',
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, 'users', 'user-1'), {
      email: 'user@example.com',
      displayName: 'User',
      role: 'user',
      active: true,
    });
    await setDoc(doc(firestore, 'users', 'manager-1'), {
      email: 'manager@example.com',
      displayName: 'Manager',
      role: 'manager',
      active: true,
    });
    await setDoc(doc(firestore, 'news', 'news-1'), {
      title: 'News',
      sourceName: 'Source',
      url: 'https://example.com',
      category: 'عام',
      importance: 'low',
      summary: '',
      fingerprint: 'fingerprint',
      publishedAt: new Date(),
      createdAt: new Date(),
      createdBy: 'manager-1',
    });
  });
});

afterAll(async () => environment.cleanup());

describe('Firestore rules', () => {
  it('denies anonymous access', async () => {
    const firestore = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(firestore, 'news', 'news-1')));
  });

  it('allows active users to read but not write news', async () => {
    const firestore = environment
      .authenticatedContext('user-1', { email: 'user@example.com' })
      .firestore();
    await assertSucceeds(getDoc(doc(firestore, 'news', 'news-1')));
    await assertFails(
      setDoc(doc(firestore, 'news', 'new'), {
        title: 'Blocked',
        sourceName: 'Source',
        url: '',
        category: 'عام',
        importance: 'low',
        summary: '',
        fingerprint: 'new',
        publishedAt: new Date(),
        createdAt: new Date(),
        createdBy: 'user-1',
      }),
    );
  });

  it('allows managers to create valid content', async () => {
    const firestore = environment
      .authenticatedContext('manager-1', { email: 'manager@example.com' })
      .firestore();
    await assertSucceeds(
      setDoc(doc(firestore, 'news', 'manager-news'), {
        title: 'Managed',
        sourceName: 'Source',
        url: '',
        category: 'عام',
        importance: 'high',
        summary: '',
        fingerprint: 'manager-news',
        publishedAt: new Date(),
        createdAt: new Date(),
        createdBy: 'manager-1',
      }),
    );
  });

  it('allows an invited user to claim only the invited role', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invites', 'invited@example.com'), {
        email: 'invited@example.com',
        role: 'user',
        status: 'pending',
        createdBy: 'bootstrap-admin',
        createdAt: new Date(),
        acceptedAt: null,
      });
    });
    const firestore = environment
      .authenticatedContext('invited-1', { email: 'invited@example.com' })
      .firestore();
    await assertSucceeds(
      setDoc(doc(firestore, 'users', 'invited-1'), {
        email: 'invited@example.com',
        displayName: 'Invited',
        role: 'user',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const escalationFirestore = environment
      .authenticatedContext('invited-2', { email: 'invited@example.com' })
      .firestore();
    await assertFails(
      setDoc(doc(escalationFirestore, 'users', 'invited-2'), {
        email: 'invited@example.com',
        displayName: 'Escalated',
        role: 'admin',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });
});
