import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

// Runtime Firebase web config is loaded from public/firebase-config.js before this module.
// Keep this fallback empty so service-account secrets are never embedded in this file.
const firebaseConfig = {};

const runtimeConfig = window.M3TM_FIREBASE_CONFIG || firebaseConfig;
const configRequiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const placeholderPrefix = 'PASTE_YOUR_';
const missingConfig = configRequiredKeys.filter((key) => {
  const value = String(runtimeConfig?.[key] || '');
  return !value || value.startsWith(placeholderPrefix);
});

const elements = {
  googleBtn: document.getElementById('authGoogleBtn'),
  loginBtn: document.getElementById('authLoginBtn'),
  registerBtn: document.getElementById('authRegisterBtn'),
  signoutBtn: document.getElementById('authSignoutBtn'),
  emailInput: document.getElementById('authEmailInput'),
  passwordInput: document.getElementById('authPasswordInput'),
  status: document.getElementById('authStatus'),
  accessBadge: document.querySelector('.access-badge')
};

const requiredElementIds = [
  'authGoogleBtn',
  'authLoginBtn',
  'authRegisterBtn',
  'authSignoutBtn',
  'authEmailInput',
  'authPasswordInput',
  'authStatus'
];

const missingElements = requiredElementIds.filter((id) => !document.getElementById(id));

function setStatus(message, type = 'info') {
  if (!elements.status) return;
  elements.status.textContent = message;
  if (type === 'error') {
    elements.status.style.borderColor = 'rgba(255, 71, 87, .45)';
    elements.status.style.color = '#ffd0d5';
    return;
  }
  if (type === 'success') {
    elements.status.style.borderColor = 'rgba(46, 213, 115, .45)';
    elements.status.style.color = '#d8ffe8';
    return;
  }
  elements.status.style.borderColor = 'rgba(130, 180, 255, .22)';
  elements.status.style.color = 'var(--muted)';
}

function setAccessBadge(icon, text) {
  if (!elements.accessBadge) return null;
  elements.accessBadge.textContent = '';
  elements.accessBadge.append(document.createTextNode(`${icon} ${text} `));
  const hint = document.createElement('span');
  hint.className = 'hint';
  elements.accessBadge.append(hint);
  return hint;
}

function getCredentials() {
  const email = elements.emailInput?.value.trim() || '';
  const password = elements.passwordInput?.value || '';
  return { email, password };
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function shouldFallbackToRedirect(error) {
  return [
    'auth/popup-blocked',
    'auth/cancelled-popup-request',
    'auth/operation-not-supported-in-this-environment'
  ].includes(error?.code);
}

function requireAuthElements() {
  if (!missingElements.length) return true;
  const message = `تعذر تهيئة واجهة المصادقة. العناصر التالية مفقودة: ${missingElements.join(', ')}`;
  setStatus(message, 'error');
  console.error('[M3TM Auth] Missing required UI elements:', missingElements);
  return false;
}

function requireFirebaseConfig() {
  if (!missingConfig.length) return true;
  const message = `إعداد Firebase غير مكتمل. أكمل القيم التالية: ${missingConfig.join(', ')}`;
  setStatus(message, 'error');
  console.error('[M3TM Auth] Incomplete Firebase config:', { missingConfig });
  return false;
}

let auth = null;
const hasRequiredElements = requireAuthElements();
if (requireFirebaseConfig()) {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(runtimeConfig);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error('[M3TM Auth] Persistence warning:', error);
    });
  } catch (error) {
    console.error('[M3TM Auth] Firebase initialization failed:', error);
    setStatus('تعذر تهيئة Firebase Auth. تحقق من الإعدادات وحاول مرة أخرى.', 'error');
  }
}

function mapAuthError(error) {
  const code = error?.code || 'unknown';
  const messages = {
    'auth/operation-not-allowed': 'طريقة تسجيل الدخول غير مفعلة من Firebase Console.',
    'auth/popup-blocked': 'المتصفح منع نافذة Google. سيتم استخدام التحويل المباشر بدل النافذة المنبثقة.',
    'auth/popup-closed-by-user': 'تم إغلاق نافذة Google قبل إتمام تسجيل الدخول.',
    'auth/cancelled-popup-request': 'تم إلغاء نافذة تسجيل الدخول. أعد المحاولة.',
    'auth/operation-not-supported-in-this-environment': 'بيئة المتصفح لا تدعم نافذة Google. سيتم استخدام التحويل المباشر.',
    'auth/email-already-in-use': 'هذا البريد مسجل مسبقًا. استخدم تسجيل الدخول.',
    'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
    'auth/weak-password': 'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.',
    'auth/invalid-credential': 'بيانات الدخول غير صحيحة.',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/network-request-failed': 'فشل الاتصال بالشبكة. تحقق من الإنترنت ثم أعد المحاولة.',
    'auth/unauthorized-domain': 'الدومين غير مصرح به في Firebase Auth > Authorized domains. أضف دومين الموقع من Firebase Console.'
  };
  return messages[code] || error?.message || 'حدث خطأ غير متوقع أثناء المصادقة.';
}

async function handleRedirectResult() {
  if (!auth) return;
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      console.log('[M3TM Auth] Google redirect login success:', result.user?.email);
      setStatus(`تم تسجيل الدخول عبر Google: ${result.user?.email || result.user?.uid}`, 'success');
    }
  } catch (error) {
    console.error('[M3TM Auth] Google redirect result failed:', error);
    setStatus(mapAuthError(error), 'error');
  }
}

async function loginWithGoogle() {
  try {
    if (!auth) throw new Error('Firebase Auth غير مهيأ بعد.');
    setStatus('جاري تسجيل الدخول عبر Google...');
    const result = await signInWithPopup(auth, createGoogleProvider());
    console.log('[M3TM Auth] Google login success:', result.user?.email);
    setStatus(`تم تسجيل الدخول عبر Google: ${result.user?.email || result.user?.uid}`, 'success');
  } catch (error) {
    console.error('[M3TM Auth] Google login failed:', error);
    if (shouldFallbackToRedirect(error) && auth) {
      setStatus('تعذر فتح نافذة Google. سيتم تحويلك إلى صفحة Google لإكمال الدخول...', 'info');
      try {
        await signInWithRedirect(auth, createGoogleProvider());
        return;
      } catch (redirectError) {
        console.error('[M3TM Auth] Google redirect login failed:', redirectError);
        setStatus(mapAuthError(redirectError), 'error');
        return;
      }
    }
    setStatus(mapAuthError(error), 'error');
  }
}

async function registerUser() {
  try {
    if (!auth) throw new Error('Firebase Auth غير مهيأ بعد.');
    const { email, password } = getCredentials();
    if (!email || !password) {
      setStatus('الرجاء إدخال البريد الإلكتروني وكلمة المرور.', 'error');
      return;
    }
    setStatus('جاري إنشاء الحساب...');
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log('[M3TM Auth] Email registration success:', result.user?.email);
    setStatus(`تم إنشاء الحساب بنجاح: ${result.user?.email || result.user?.uid}`, 'success');
  } catch (error) {
    console.error('[M3TM Auth] Email registration failed:', error);
    setStatus(mapAuthError(error), 'error');
  }
}

async function loginUser() {
  try {
    if (!auth) throw new Error('Firebase Auth غير مهيأ بعد.');
    const { email, password } = getCredentials();
    if (!email || !password) {
      setStatus('الرجاء إدخال البريد الإلكتروني وكلمة المرور.', 'error');
      return;
    }
    setStatus('جاري تسجيل الدخول...');
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('[M3TM Auth] Email login success:', result.user?.email);
    setStatus(`مرحبًا ${result.user?.email || result.user?.uid}`, 'success');
  } catch (error) {
    console.error('[M3TM Auth] Email login failed:', error);
    setStatus(mapAuthError(error), 'error');
  }
}

async function logoutUser() {
  try {
    if (!auth) throw new Error('Firebase Auth غير مهيأ بعد.');
    await signOut(auth);
    console.log('[M3TM Auth] User signed out.');
    setStatus('تم تسجيل الخروج بنجاح.', 'info');
  } catch (error) {
    console.error('[M3TM Auth] Sign out failed:', error);
    setStatus(mapAuthError(error), 'error');
  }
}

if (hasRequiredElements) {
  if (elements.googleBtn) elements.googleBtn.addEventListener('click', loginWithGoogle);
  if (elements.registerBtn) elements.registerBtn.addEventListener('click', registerUser);
  if (elements.loginBtn) elements.loginBtn.addEventListener('click', loginUser);
  if (elements.signoutBtn) elements.signoutBtn.addEventListener('click', logoutUser);
}

if (auth) {
  handleRedirectResult();
  onAuthStateChanged(auth, (user) => {
    if (user) {
      setStatus(`جلسة نشطة: ${user.email || user.uid}`, 'success');
      const hint = setAccessBadge('✅', 'جلسة موثقة');
      if (hint) hint.textContent = user.email || user.uid;
      return;
    }
    setStatus('لا توجد جلسة نشطة. يمكنك تسجيل الدخول عبر Google أو البريد.', 'info');
    const hint = setAccessBadge('🔐', 'يتطلب تسجيل دخول');
    if (hint) hint.textContent = 'Firebase Auth';
  });
}
