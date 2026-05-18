// M3TM RASED authentication UI extension
// Adds Google + Email/Password auth without changing the core dashboard layout.
(function () {
  const css = `
    .m3tm-auth-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.58);display:none;align-items:center;justify-content:center;padding:18px}
    .m3tm-auth-box{width:min(430px,96vw);border:1px solid rgba(120,185,255,.34);border-radius:18px;background:rgba(3,11,24,.88);box-shadow:0 0 40px rgba(70,140,255,.22);padding:18px;color:rgba(244,249,255,.94);font-family:Tahoma,Arial}
    .m3tm-auth-box h3{margin:0 0 10px;font-size:20px}.m3tm-auth-box p{color:rgba(220,235,250,.7);font-size:12px;line-height:1.7}
    .m3tm-auth-field{width:100%;margin-top:8px;padding:11px;border-radius:10px;border:1px solid rgba(120,180,255,.28);background:rgba(0,0,0,.26);color:#fff;outline:none}
    .m3tm-auth-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.m3tm-auth-btn{cursor:pointer;border:1px solid rgba(120,185,255,.34);border-radius:10px;background:rgba(5,14,28,.55);color:#fff;font-weight:900;padding:10px}.m3tm-auth-btn.primary{background:linear-gradient(180deg,#338eff,#0c55be)}.m3tm-auth-msg{min-height:24px;margin-top:10px;color:rgba(220,235,250,.75);font-size:12px;white-space:pre-wrap}.m3tm-auth-close{float:left;background:transparent;border:0;color:#fff;font-size:20px;cursor:pointer}
  `;

  function addStyle() {
    if (document.getElementById('m3tmAuthStyle')) return;
    const style = document.createElement('style');
    style.id = 'm3tmAuthStyle';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildModal() {
    if (document.getElementById('m3tmAuthModal')) return;
    const modal = document.createElement('div');
    modal.id = 'm3tmAuthModal';
    modal.className = 'm3tm-auth-backdrop';
    modal.innerHTML = `
      <div class="m3tm-auth-box" dir="rtl">
        <button class="m3tm-auth-close" id="m3tmAuthClose" type="button">×</button>
        <h3>دخول M3TM RASED</h3>
        <p>اختر الدخول السريع عبر Google أو استخدم البريد وكلمة المرور بعد تفعيل Email/Password من Firebase.</p>
        <button class="m3tm-auth-btn primary" id="m3tmGoogleLogin" type="button">الدخول عبر Google</button>
        <input class="m3tm-auth-field" id="m3tmAuthEmail" type="email" placeholder="البريد الإلكتروني">
        <input class="m3tm-auth-field" id="m3tmAuthPassword" type="password" placeholder="كلمة المرور">
        <div class="m3tm-auth-row">
          <button class="m3tm-auth-btn primary" id="m3tmEmailLogin" type="button">تسجيل الدخول</button>
          <button class="m3tm-auth-btn" id="m3tmEmailRegister" type="button">إنشاء حساب</button>
        </div>
        <div class="m3tm-auth-msg" id="m3tmAuthMsg"></div>
      </div>`;
    document.body.appendChild(modal);

    const msg = document.getElementById('m3tmAuthMsg');
    const setMsg = (text) => { msg.textContent = text || ''; };
    const close = () => { modal.style.display = 'none'; };
    const open = () => { modal.style.display = 'flex'; setMsg(''); };

    document.getElementById('m3tmAuthClose').onclick = close;
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    async function ensureAuth() {
      if (!window.firebase || !firebase.auth) throw new Error('Firebase Auth غير محمل بعد. حدّث الصفحة.');
      return firebase.auth();
    }

    document.getElementById('m3tmGoogleLogin').onclick = async () => {
      try {
        setMsg('جاري تسجيل الدخول عبر Google...');
        const auth = await ensureAuth();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        await auth.signInWithPopup(provider);
        setMsg('تم تسجيل الدخول بنجاح.');
        close();
      } catch (error) {
        setMsg('فشل تسجيل Google:\n' + (error.message || error));
        console.error(error);
      }
    };

    document.getElementById('m3tmEmailLogin').onclick = async () => {
      try {
        const email = document.getElementById('m3tmAuthEmail').value.trim();
        const password = document.getElementById('m3tmAuthPassword').value;
        if (!email || !password) return setMsg('اكتب البريد وكلمة المرور.');
        setMsg('جاري تسجيل الدخول بالبريد...');
        const auth = await ensureAuth();
        await auth.signInWithEmailAndPassword(email, password);
        setMsg('تم تسجيل الدخول بنجاح.');
        close();
      } catch (error) {
        setMsg('فشل تسجيل الدخول:\n' + (error.message || error));
        console.error(error);
      }
    };

    document.getElementById('m3tmEmailRegister').onclick = async () => {
      try {
        const email = document.getElementById('m3tmAuthEmail').value.trim();
        const password = document.getElementById('m3tmAuthPassword').value;
        if (!email || !password) return setMsg('اكتب البريد وكلمة المرور.');
        if (password.length < 6) return setMsg('كلمة المرور يجب ألا تقل عن 6 أحرف.');
        setMsg('جاري إنشاء الحساب...');
        const auth = await ensureAuth();
        await auth.createUserWithEmailAndPassword(email, password);
        setMsg('تم إنشاء الحساب والدخول.');
        close();
      } catch (error) {
        setMsg('فشل إنشاء الحساب:\n' + (error.message || error));
        console.error(error);
      }
    };

    window.openM3TMAuth = open;
    const originalLogin = window.login;
    window.login = async function () {
      try {
        if (window.firebase && firebase.auth && firebase.auth().currentUser) {
          await firebase.auth().signOut();
          return;
        }
      } catch (error) {
        console.error(error);
      }
      open();
    };
    window.login.original = originalLogin;
  }

  function initAuthUI() {
    addStyle();
    buildModal();
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.onclick = window.login;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAuthUI);
  else initAuthUI();
})();
