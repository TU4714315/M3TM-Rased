// M3TM RASED - Login page logic
(function () {
  var msg = document.getElementById('msg');
  var diag = document.getElementById('diag');

  function setMsg(text) { if (msg) msg.textContent = text || ''; }
  function setDiag(text) { if (diag) diag.textContent = text || ''; }

  function initDiag() {
    var lines = [];
    lines.push('Firebase SDK: ' + (window.firebase ? '✅ محمّل' : '❌ غير محمّل'));
    lines.push('Config: ' + (window.M3TM_FIREBASE_CONFIG ? '✅ موجود' : '❌ مفقود'));
    lines.push('Browser: ' + navigator.userAgent.slice(0, 60));
    lines.push('Time: ' + new Date().toLocaleString('ar-SA'));
    setDiag(lines.join('\n'));
  }

  function initFirebase() {
    if (!window.firebase) return null;
    if (!window.M3TM_FIREBASE_CONFIG) return null;
    try {
      // Reuse existing app if already initialized
      return firebase.app();
    } catch (e) {
      firebase.initializeApp(window.M3TM_FIREBASE_CONFIG);
      return firebase.app();
    }
  }

  function getAuth() {
    var app = initFirebase();
    if (!app) throw new Error('Firebase غير مهيّأ. تحقق من firebase-config.js');
    var auth = firebase.auth();
    auth.useDeviceLanguage();
    return auth;
  }

  var googleBtn = document.getElementById('googleBtn');
  var emailLoginBtn = document.getElementById('emailLoginBtn');
  var registerBtn = document.getElementById('registerBtn');

  if (googleBtn) {
    googleBtn.onclick = function () {
      setMsg('جاري تسجيل الدخول عبر Google...');
      try {
        var auth = getAuth();
        var provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        auth.signInWithPopup(provider).then(function () {
          setMsg('✅ تم تسجيل الدخول بنجاح. جاري التوجيه...');
          setTimeout(function () { location.href = '/'; }, 800);
        }).catch(function (e) {
          setMsg('❌ فشل تسجيل Google:\n' + e.message);
        });
      } catch (e) {
        setMsg('❌ خطأ: ' + e.message);
      }
    };
  }

  if (emailLoginBtn) {
    emailLoginBtn.onclick = function () {
      var email = (document.getElementById('email') || {}).value || '';
      var password = (document.getElementById('password') || {}).value || '';
      email = email.trim();
      if (!email || !password) { setMsg('اكتب البريد الإلكتروني وكلمة المرور.'); return; }
      setMsg('جاري تسجيل الدخول...');
      try {
        var auth = getAuth();
        auth.signInWithEmailAndPassword(email, password).then(function () {
          setMsg('✅ تم تسجيل الدخول بنجاح. جاري التوجيه...');
          setTimeout(function () { location.href = '/'; }, 800);
        }).catch(function (e) {
          setMsg('❌ فشل تسجيل الدخول:\n' + e.message);
        });
      } catch (e) {
        setMsg('❌ خطأ: ' + e.message);
      }
    };
  }

  if (registerBtn) {
    registerBtn.onclick = function () {
      var email = (document.getElementById('email') || {}).value || '';
      var password = (document.getElementById('password') || {}).value || '';
      email = email.trim();
      if (!email || !password) { setMsg('اكتب البريد الإلكتروني وكلمة المرور.'); return; }
      if (password.length < 6) { setMsg('كلمة المرور يجب ألا تقل عن 6 أحرف.'); return; }
      setMsg('جاري إنشاء الحساب...');
      try {
        var auth = getAuth();
        auth.createUserWithEmailAndPassword(email, password).then(function () {
          setMsg('✅ تم إنشاء الحساب وتسجيل الدخول. جاري التوجيه...');
          setTimeout(function () { location.href = '/'; }, 800);
        }).catch(function (e) {
          setMsg('❌ فشل إنشاء الحساب:\n' + e.message);
        });
      } catch (e) {
        setMsg('❌ خطأ: ' + e.message);
      }
    };
  }

  // Check if already signed in → redirect
  try {
    var app = initFirebase();
    if (app) {
      firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
          setMsg('✅ أنت مسجّل الدخول بالفعل. جاري التوجيه...');
          setTimeout(function () { location.href = '/'; }, 600);
        } else {
          setMsg('جاهز للمصادقة...');
        }
        initDiag();
      });
    } else {
      setMsg('تعذر تهيئة Firebase. تحقق من الاتصال.');
      initDiag();
    }
  } catch (e) {
    setMsg('خطأ في تهيئة Firebase: ' + e.message);
    initDiag();
  }
})();
