import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    console.log('Google login success:', credential.user.email);
    return { ok: true, user: credential.user };
  } catch (error) {
    console.error('Google login failed:', error);
    return { ok: false, error: error.message };
  }
}

export async function registerWithEmail(email, password) {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Email registration success:', credential.user.email);
    return { ok: true, user: credential.user };
  } catch (error) {
    console.error('Email registration failed:', error);
    return { ok: false, error: error.message };
  }
}

export async function loginWithEmail(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Email login success:', credential.user.email);
    return { ok: true, user: credential.user };
  } catch (error) {
    console.error('Email login failed:', error);
    return { ok: false, error: error.message };
  }
}
