import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { firebaseConfig } from './firebaseConfig.js?v=autoheal-20260518';

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingConfigKeys = requiredConfigKeys.filter((key) => !firebaseConfig?.[key] || String(firebaseConfig[key]).includes('YOUR_'));

if (missingConfigKeys.length) {
  console.error('[M3TM Auth] Firebase config is incomplete:', missingConfigKeys);
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('[M3TM Auth] Persistence setup warning:', error);
});

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const errorMap = {
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'مفتاح Firebase API غير صالح أو أن المتصفح يقرأ نسخة قديمة من ملف الإعدادات.',
  'auth/invalid-api-key': 'مفتاح Firebase API غير صالح. تحقق من firebaseConfig أو امسح كاش الموقع.',
  'auth/unauthorized-domain': 'الدومين غير مصرح في Firebase. أضف m3tm.app في Authentication > Settings > Authorized domains.',
  'auth/operation-not-allowed': 'طريقة الدخول غير مفعلة. فعّل Google أو Email/Password من Authentication > Sign-in method.',
  'auth/popup-blocked': 'المتصفح منع نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة أو استخدم متصفح آخر.',
  'auth/popup-closed-by-user': 'تم إغلاق نافذة الدخول قبل إكمال العملية.',
  'auth/user-not-found': 'لا يوجد حساب بهذا البريد. استخدم إنشاء حساب أو Google.',
  'auth/wrong-password': 'كلمة المرور غير صحيحة.',
  'auth/invalid-credential': 'بيانات الدخول غير صحيحة أو انتهت صلاحيتها.',
  'auth/email-already-in-use': 'هذا البريد مسجل مسبقًا. استخدم تسجيل الدخول بدل إنشاء حساب.',
  'auth/weak-password': 'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.',
  'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
  'auth/network-request-failed': 'فشل الاتصال بالشبكة. تحقق من الإنترنت أو VPN.'
};

function normalizeFirebaseCode(error) {
  const code = error?.code || 'unknown';
  return String(code).trim();
}

function buildAuthError(error, context) {
  const code = normalizeFirebaseCode(error);
  const fallbackMessage = error?.message || 'خطأ غير معروف في Firebase Auth.';
  const friendly = errorMap[code] || fallbackMessage;
  const diagnostic = {
    ok: false,
    context,
    code,
    message: friendly,
    rawMessage: fallbackMessage,
    config: {
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      appId: firebaseConfig.appId,
      apiKeyPrefix: `${firebaseConfig.apiKey?.slice(0, 10)}...${firebaseConfig.apiKey?.slice(-6)}`
    },
    ts: new Date().toISOString()
  };
  console.error('[M3TM Auth Diagnostic]', diagnostic);
  return diagnostic;
}

function buildSuccess(user, context) {
  return {
    ok: true,
    context,
    user,
    email: user?.email || null,
    uid: user?.uid || null,
    ts: new Date().toISOString()
  };
}

export function getAuthDiagnostics() {
  return {
    ok: missingConfigKeys.length === 0,
    missingConfigKeys,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    appId: firebaseConfig.appId,
    apiKeyPreview: `${firebaseConfig.apiKey?.slice(0, 10)}...${firebaseConfig.apiKey?.slice(-6)}`,
    origin: globalThis.location?.origin || 'unknown',
    href: globalThis.location?.href || 'unknown',
    build: 'autoheal-20260518'
  };
}

export async function loginWithGoogle() {
  try {
    if (missingConfigKeys.length) throw new Error(`Missing Firebase config keys: ${missingConfigKeys.join(', ')}`);
    const credential = await signInWithPopup(auth, googleProvider);
    console.log('[M3TM Auth] Google login success:', credential.user.email);
    return buildSuccess(credential.user, 'google');
  } catch (error) {
    return buildAuthError(error, 'google');
  }
}

export async function registerWithEmail(email, password) {
  try {
    if (missingConfigKeys.length) throw new Error(`Missing Firebase config keys: ${missingConfigKeys.join(', ')}`);
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('[M3TM Auth] Email registration success:', credential.user.email);
    return buildSuccess(credential.user, 'email-register');
  } catch (error) {
    return buildAuthError(error, 'email-register');
  }
}

export async function loginWithEmail(email, password) {
  try {
    if (missingConfigKeys.length) throw new Error(`Missing Firebase config keys: ${missingConfigKeys.join(', ')}`);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    console.log('[M3TM Auth] Email login success:', credential.user.email);
    return buildSuccess(credential.user, 'email-login');
  } catch (error) {
    return buildAuthError(error, 'email-login');
  }
}
