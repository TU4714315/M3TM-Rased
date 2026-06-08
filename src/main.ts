import './styles.css';
import type { Unsubscribe } from 'firebase/firestore';
import {
  loginWithEmail,
  loginWithGoogle,
  logout,
  observeSession,
  registerInvitedUser,
  type Session,
} from './lib/auth';
import {
  createInvite,
  createNews,
  deleteNews,
  deleteSource,
  importanceLabels,
  requestSync,
  revokeInvite,
  saveSource,
  subscribeInvites,
  subscribeNews,
  subscribeSources,
  subscribeSyncRuns,
  subscribeUsers,
  updateUserAccess,
} from './lib/data';
import { importLegacyData, previewLegacyImport, type ImportPreview } from './lib/migration';
import { canManageContent, canManageUsers } from './lib/permissions';
import type { Invite, NewsItem, Role, Source, SyncRun, UserProfile } from './types';

type Route = 'dashboard' | 'news' | 'sources' | 'users' | 'import';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('App root is missing.');
const app = appRoot;

const state: {
  session: Session;
  route: Route;
  news: NewsItem[];
  sources: Source[];
  users: UserProfile[];
  invites: Invite[];
  syncRuns: SyncRun[];
  importPreview: ImportPreview | null;
  error: string;
  loading: boolean;
  unsubscribers: Unsubscribe[];
} = {
  session: { user: null, profile: null, blockedReason: null },
  route: 'dashboard',
  news: [],
  sources: [],
  users: [],
  invites: [],
  syncRuns: [],
  importPreview: null,
  error: '',
  loading: true,
  unsubscribers: [],
};

function escapeStatic(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

function routeFromHash(): Route {
  const route = location.hash.replace(/^#\/?/, '') as Route;
  return ['dashboard', 'news', 'sources', 'users', 'import'].includes(route)
    ? route
    : 'dashboard';
}

function formatDate(value: unknown): string {
  if (!value) return 'لم يحدث بعد';
  const maybeTimestamp = value as { toDate?: () => Date };
  const date = typeof maybeTimestamp.toDate === 'function' ? maybeTimestamp.toDate() : new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'غير معروف';
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function setMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const element = document.querySelector<HTMLDivElement>('#global-message');
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
  element.hidden = !message;
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع.';
  if (message.includes('permission-denied')) return 'لا تملك الصلاحية المطلوبة.';
  if (message.includes('invalid-credential')) return 'بيانات الدخول غير صحيحة.';
  if (message.includes('popup-closed')) return 'أغلقت نافذة Google قبل إكمال الدخول.';
  if (message.includes('unauthorized-domain')) return 'الدومين غير مضاف إلى نطاقات Firebase المصرح بها.';
  return message;
}

function clearSubscriptions(): void {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
}

function subscribeToData(): void {
  clearSubscriptions();
  if (!state.session.profile) return;
  const onError = (error: Error) => {
    state.error = friendlyError(error);
    render();
  };
  state.unsubscribers.push(
    subscribeNews((items) => {
      state.news = items;
      renderCurrentView();
    }, onError),
    subscribeSources((items) => {
      state.sources = items;
      renderCurrentView();
    }, onError),
  );
  if (canManageUsers(state.session.profile.role)) {
    state.unsubscribers.push(
      subscribeUsers((items) => {
        state.users = items;
        renderCurrentView();
      }, onError),
      subscribeInvites((items) => {
        state.invites = items;
        renderCurrentView();
      }, onError),
    );
  }
  if (canManageContent(state.session.profile.role)) {
    state.unsubscribers.push(
      subscribeSyncRuns((items) => {
        state.syncRuns = items;
        renderCurrentView();
      }, onError),
    );
  }
}

function renderLoading(): void {
  app.innerHTML = `
    <main class="center-screen">
      <div class="loader" aria-hidden="true"></div>
      <p>جارٍ التحقق من الجلسة والصلاحيات...</p>
    </main>
  `;
}

function renderLogin(): void {
  const blocked = state.session.blockedReason;
  app.innerHTML = `
    <main class="login-layout">
      <section class="login-brand" aria-labelledby="brand-title">
        <p class="system-label">منصة الرصد الآمنة</p>
        <h1 id="brand-title">M3<sup>TM</sup> - RASED</h1>
        <p>إدارة الأخبار والمصادر والمزامنة من مساحة تشغيل واحدة، بصلاحيات واضحة وتحديثات موثقة.</p>
        <ul>
          <li>وصول بالدعوات فقط</li>
          <li>مزامنة RSS وAtom كل 15 دقيقة</li>
          <li>أدوار Admin وManager وUser</li>
        </ul>
      </section>
      <section class="login-card" aria-labelledby="login-title">
        <div>
          <p class="eyebrow">دخول موثوق</p>
          <h2 id="login-title">مرحبًا بعودتك</h2>
          <p class="muted">استخدم حساب Google أو البريد المدعو إلى المنصة.</p>
        </div>
        ${blocked ? `<div class="notice error">${escapeStatic(blocked)}</div>` : ''}
        <button class="button google" id="google-login" type="button">المتابعة عبر Google</button>
        <div class="divider"><span>أو بالبريد</span></div>
        <form id="email-login-form" class="form-stack">
          <label>البريد الإلكتروني<input id="login-email" type="email" autocomplete="email" required /></label>
          <label>كلمة المرور<input id="login-password" type="password" autocomplete="current-password" minlength="6" required /></label>
          <button class="button primary" type="submit">تسجيل الدخول</button>
        </form>
        <button class="button text" id="register-invited" type="button">إنشاء حساب لبريد مدعو</button>
        <div id="login-message" class="notice" hidden></div>
      </section>
    </main>
  `;

  const message = document.querySelector<HTMLDivElement>('#login-message');
  const showLoginMessage = (text: string, type: 'error' | 'info' = 'info') => {
    if (!message) return;
    message.textContent = text;
    message.className = `notice ${type}`;
    message.hidden = false;
  };

  document.querySelector('#google-login')?.addEventListener('click', async () => {
    try {
      showLoginMessage('جارٍ فتح Google...');
      await loginWithGoogle();
    } catch (error) {
      showLoginMessage(friendlyError(error), 'error');
    }
  });

  document.querySelector<HTMLFormElement>('#email-login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.querySelector<HTMLInputElement>('#login-email')?.value ?? '';
    const password = document.querySelector<HTMLInputElement>('#login-password')?.value ?? '';
    try {
      showLoginMessage('جارٍ تسجيل الدخول...');
      await loginWithEmail(email, password);
    } catch (error) {
      showLoginMessage(friendlyError(error), 'error');
    }
  });

  document.querySelector('#register-invited')?.addEventListener('click', async () => {
    const email = document.querySelector<HTMLInputElement>('#login-email')?.value ?? '';
    const password = document.querySelector<HTMLInputElement>('#login-password')?.value ?? '';
    if (!email || password.length < 6) {
      showLoginMessage('أدخل البريد المدعو وكلمة مرور من 6 أحرف على الأقل.', 'error');
      return;
    }
    try {
      showLoginMessage('جارٍ إنشاء الحساب والتحقق من الدعوة...');
      await registerInvitedUser(email, password);
    } catch (error) {
      showLoginMessage(friendlyError(error), 'error');
    }
  });
}

function navButton(route: Route, label: string): string {
  const active = state.route === route ? 'active' : '';
  return `<a class="nav-link ${active}" href="#/${route}" data-route="${route}">${label}</a>`;
}

function renderShell(): void {
  const profile = state.session.profile;
  if (!profile) return;
  const adminLinks = canManageUsers(profile.role)
    ? `${navButton('users', 'المستخدمون')}${navButton('import', 'الاستيراد')}`
    : '';
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="#/dashboard" aria-label="M3TM RASED">
          <span class="brand-mark">M3</span>
          <span><strong>RASED</strong><small>منصة الرصد</small></span>
        </a>
        <nav aria-label="التنقل الرئيسي">
          ${navButton('dashboard', 'لوحة الرصد')}
          ${navButton('news', 'الأخبار')}
          ${navButton('sources', 'المصادر')}
          ${adminLinks}
        </nav>
        <div class="sidebar-footer">
          <span class="role-badge">${escapeStatic(profile.role.toUpperCase())}</span>
          <strong>${escapeStatic(profile.displayName)}</strong>
          <small>${escapeStatic(profile.email)}</small>
          <button class="button text light" id="logout-button" type="button">تسجيل الخروج</button>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <button class="menu-button" id="menu-button" type="button" aria-label="فتح القائمة">☰</button>
          <div>
            <p class="system-label">M3TM RASED</p>
            <h1 id="page-title">لوحة الرصد</h1>
          </div>
          <div class="live-status"><span></span> اتصال مباشر</div>
        </header>
        <div id="global-message" class="notice" hidden></div>
        <main id="view" tabindex="-1"></main>
      </div>
    </div>
  `;
  document.querySelector('#logout-button')?.addEventListener('click', () => void logout());
  document.querySelector('#menu-button')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
  });
}

function make(tag: string, className = '', text = ''): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function renderDashboard(view: HTMLElement): void {
  const profile = state.session.profile;
  if (!profile) return;
  const lastRun = state.syncRuns[0];
  view.innerHTML = `
    <section class="page-heading">
      <div><p class="eyebrow">نظرة تشغيلية</p><h2>كل ما يحتاج انتباهك الآن</h2></div>
      ${
        canManageContent(profile.role)
          ? '<button class="button primary compact" id="request-sync" type="button">طلب مزامنة</button>'
          : ''
      }
    </section>
    <section class="metrics" aria-label="ملخص النظام">
      <article><span>الأخبار</span><strong>${state.news.length}</strong><small>خبر محفوظ</small></article>
      <article><span>المصادر</span><strong>${state.sources.length}</strong><small>${state.sources.filter((item) => item.status === 'active').length} مصدر نشط</small></article>
      <article><span>آخر مزامنة</span><strong class="date-value">${lastRun ? formatDate(lastRun.finishedAt) : 'لا توجد'}</strong><small>${lastRun?.status === 'failed' ? 'تحتاج مراجعة' : 'حالة مستقرة'}</small></article>
      <article><span>صلاحيتك</span><strong class="date-value">${profile.role.toUpperCase()}</strong><small>جلسة موثقة</small></article>
    </section>
    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-heading"><div><p class="eyebrow">أحدث الرصد</p><h3>آخر الأخبار</h3></div><a href="#/news">عرض الكل</a></div>
        <div id="recent-news" class="compact-list"></div>
      </article>
      <article class="panel">
        <div class="panel-heading"><div><p class="eyebrow">صحة المحرك</p><h3>سجل المزامنة</h3></div></div>
        <div id="recent-sync" class="compact-list"></div>
      </article>
    </section>
  `;

  const newsList = view.querySelector('#recent-news');
  state.news.slice(0, 5).forEach((item) => {
    const row = make('div', 'compact-row');
    const content = make('div');
    content.append(make('strong', '', item.title), make('small', '', `${item.sourceName} · ${formatDate(item.publishedAt)}`));
    row.append(content, make('span', `importance ${item.importance}`, importanceLabels[item.importance]));
    newsList?.append(row);
  });
  if (!state.news.length) newsList?.append(make('p', 'empty', 'لا توجد أخبار بعد.'));

  const syncList = view.querySelector('#recent-sync');
  state.syncRuns.slice(0, 5).forEach((item) => {
    const row = make('div', 'compact-row');
    const content = make('div');
    content.append(
      make('strong', '', item.sourceName),
      make('small', '', `${item.inserted} جديد · ${item.skipped} مكرر · ${formatDate(item.finishedAt)}`),
    );
    row.append(content, make('span', `sync-state ${item.status}`, item.status));
    syncList?.append(row);
  });
  if (!state.syncRuns.length) syncList?.append(make('p', 'empty', 'لم تسجل عمليات مزامنة بعد.'));

  view.querySelector('#request-sync')?.addEventListener('click', async () => {
    try {
      await requestSync(profile.id);
      setMessage('تم تسجيل الطلب وسيعالجه محرك المزامنة في الدورة التالية.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
}

function renderNews(view: HTMLElement): void {
  const profile = state.session.profile;
  if (!profile) return;
  view.innerHTML = `
    <section class="page-heading">
      <div><p class="eyebrow">الأرشيف الحي</p><h2>الأخبار والرصد</h2></div>
      <input class="search" id="news-search" type="search" placeholder="ابحث في الأخبار..." aria-label="بحث الأخبار" />
    </section>
    ${
      canManageContent(profile.role)
        ? `<details class="panel editor">
            <summary>إضافة خبر يدوي</summary>
            <form id="news-form" class="form-grid">
              <label>العنوان<input name="title" required maxlength="180" /></label>
              <label>المصدر<input name="sourceName" required maxlength="120" /></label>
              <label>الرابط<input name="url" type="url" /></label>
              <label>التصنيف<input name="category" value="عام" maxlength="80" /></label>
              <label>الأهمية<select name="importance"><option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">عالٍ</option><option value="critical">حرج</option></select></label>
              <label class="wide">الملخص<textarea name="summary" rows="3" maxlength="2000"></textarea></label>
              <button class="button primary compact" type="submit">حفظ الخبر</button>
            </form>
          </details>`
        : ''
    }
    <section id="news-results" class="news-list"></section>
  `;

  const draw = (query = '') => {
    const container = view.querySelector('#news-results');
    if (!container) return;
    container.textContent = '';
    const normalized = query.trim().toLowerCase();
    const items = state.news.filter((item) =>
      `${item.title} ${item.sourceName} ${item.category} ${item.summary}`.toLowerCase().includes(normalized),
    );
    items.forEach((item) => {
      const article = make('article', 'news-row');
      const body = make('div', 'news-body');
      const meta = make('div', 'news-meta');
      meta.append(
        make('span', `importance ${item.importance}`, importanceLabels[item.importance]),
        make('span', '', item.category),
        make('span', '', item.sourceName),
      );
      body.append(meta, make('h3', '', item.title));
      if (item.summary) body.append(make('p', '', item.summary));
      const footer = make('div', 'row-footer');
      footer.append(make('small', '', formatDate(item.publishedAt)));
      if (item.url) {
        const link = make('a', '', 'فتح المصدر') as HTMLAnchorElement;
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        footer.append(link);
      }
      body.append(footer);
      article.append(body);
      if (canManageContent(profile.role)) {
        const button = make('button', 'icon-button danger', 'حذف') as HTMLButtonElement;
        button.type = 'button';
        button.addEventListener('click', async () => {
          if (!confirm('هل تريد حذف هذا الخبر؟')) return;
          try {
            await deleteNews(item.id);
          } catch (error) {
            setMessage(friendlyError(error), 'error');
          }
        });
        article.append(button);
      }
      container.append(article);
    });
    if (!items.length) container.append(make('p', 'empty panel', 'لا توجد نتائج مطابقة.'));
  };
  draw();
  view.querySelector<HTMLInputElement>('#news-search')?.addEventListener('input', (event) => {
    draw((event.target as HTMLInputElement).value);
  });
  view.querySelector<HTMLFormElement>('#news-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const form = new FormData(formElement);
    try {
      await createNews({
        title: String(form.get('title') ?? ''),
        sourceName: String(form.get('sourceName') ?? ''),
        sourceId: '',
        url: String(form.get('url') ?? ''),
        category: String(form.get('category') ?? 'عام'),
        importance: String(form.get('importance') ?? 'low') as NewsItem['importance'],
        summary: String(form.get('summary') ?? ''),
        createdBy: profile.id,
      });
      formElement.reset();
      setMessage('تم حفظ الخبر.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
}

function renderSources(view: HTMLElement): void {
  const profile = state.session.profile;
  if (!profile) return;
  view.innerHTML = `
    <section class="page-heading">
      <div><p class="eyebrow">مكتبة الرصد</p><h2>مصادر RSS وAtom</h2></div>
      <input class="search" id="source-search" type="search" placeholder="ابحث في المصادر..." aria-label="بحث المصادر" />
    </section>
    ${
      canManageContent(profile.role)
        ? `<details class="panel editor">
            <summary>إضافة مصدر</summary>
            <form id="source-form" class="form-grid">
              <input name="id" type="hidden" />
              <label>اسم المصدر<input name="name" required maxlength="140" /></label>
              <label>رابط Feed<input name="feedUrl" type="url" required /></label>
              <label>رابط الموقع<input name="siteUrl" type="url" /></label>
              <label>التصنيف<input name="category" value="عام" maxlength="80" /></label>
              <label>الحالة<select name="status"><option value="active">نشط</option><option value="paused">متوقف</option></select></label>
              <button class="button primary compact" type="submit">حفظ المصدر</button>
              <button class="button secondary compact" id="source-cancel" type="button">إلغاء التعديل</button>
            </form>
          </details>`
        : ''
    }
    <section id="source-results" class="source-grid"></section>
  `;

  const form = view.querySelector<HTMLFormElement>('#source-form');
  const draw = (query = '') => {
    const container = view.querySelector('#source-results');
    if (!container) return;
    container.textContent = '';
    const normalized = query.trim().toLowerCase();
    const items = state.sources.filter((item) =>
      `${item.name} ${item.category} ${item.feedUrl}`.toLowerCase().includes(normalized),
    );
    items.forEach((item) => {
      const article = make('article', 'source-card');
      const heading = make('div', 'source-heading');
      heading.append(make('h3', '', item.name), make('span', `source-state ${item.status}`, item.status));
      article.append(heading, make('p', '', item.category));
      const feed = make('a', 'source-link', item.feedUrl) as HTMLAnchorElement;
      feed.href = item.feedUrl;
      feed.target = '_blank';
      feed.rel = 'noopener noreferrer';
      article.append(feed, make('small', '', `آخر مزامنة: ${formatDate(item.lastSyncAt)}`));
      if (item.lastError) article.append(make('p', 'inline-error', item.lastError));
      if (canManageContent(profile.role)) {
        const actions = make('div', 'card-actions');
        const edit = make('button', 'button secondary compact', 'تعديل') as HTMLButtonElement;
        edit.type = 'button';
        edit.addEventListener('click', () => {
          if (!form) return;
          (form.elements.namedItem('id') as HTMLInputElement).value = item.id;
          (form.elements.namedItem('name') as HTMLInputElement).value = item.name;
          (form.elements.namedItem('feedUrl') as HTMLInputElement).value = item.feedUrl;
          (form.elements.namedItem('siteUrl') as HTMLInputElement).value = item.siteUrl;
          (form.elements.namedItem('category') as HTMLInputElement).value = item.category;
          (form.elements.namedItem('status') as HTMLSelectElement).value = item.status;
          form.closest('details')?.setAttribute('open', '');
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        const remove = make('button', 'button danger compact', 'حذف') as HTMLButtonElement;
        remove.type = 'button';
        remove.addEventListener('click', async () => {
          if (!confirm('هل تريد حذف المصدر؟')) return;
          try {
            await deleteSource(item.id);
          } catch (error) {
            setMessage(friendlyError(error), 'error');
          }
        });
        actions.append(edit, remove);
        article.append(actions);
      }
      container.append(article);
    });
    if (!items.length) container.append(make('p', 'empty panel', 'لا توجد مصادر مطابقة.'));
  };
  draw();
  view.querySelector<HTMLInputElement>('#source-search')?.addEventListener('input', (event) => {
    draw((event.target as HTMLInputElement).value);
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const values = new FormData(formElement);
    try {
      await saveSource(String(values.get('id') || '') || null, {
        name: String(values.get('name') ?? ''),
        feedUrl: String(values.get('feedUrl') ?? ''),
        siteUrl: String(values.get('siteUrl') ?? ''),
        category: String(values.get('category') ?? 'عام'),
        status: String(values.get('status') ?? 'active') as Source['status'],
        createdBy: profile.id,
      });
      formElement.reset();
      setMessage('تم حفظ المصدر.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
  view.querySelector('#source-cancel')?.addEventListener('click', () => form?.reset());
}

function renderUsers(view: HTMLElement): void {
  const profile = state.session.profile;
  if (!profile || !canManageUsers(profile.role)) {
    view.append(make('p', 'notice error', 'هذه الصفحة متاحة للمدير فقط.'));
    return;
  }
  view.innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">إدارة الوصول</p><h2>المستخدمون والدعوات</h2></div></section>
    <section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">دعوة جديدة</p><h3>منح وصول</h3></div></div>
      <form id="invite-form" class="inline-form">
        <label>البريد الإلكتروني<input name="email" type="email" required /></label>
        <label>الدور<select name="role"><option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label>
        <button class="button primary compact" type="submit">إرسال الدعوة</button>
      </form>
    </section>
    <section class="panel table-panel">
      <div class="panel-heading"><div><p class="eyebrow">الحسابات</p><h3>المستخدمون النشطون</h3></div></div>
      <div class="table-wrap"><table><thead><tr><th>المستخدم</th><th>الدور</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody id="users-body"></tbody></table></div>
    </section>
    <section class="panel table-panel">
      <div class="panel-heading"><div><p class="eyebrow">قائمة الانتظار</p><h3>الدعوات</h3></div></div>
      <div class="table-wrap"><table><thead><tr><th>البريد</th><th>الدور</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody id="invites-body"></tbody></table></div>
    </section>
  `;
  const usersBody = view.querySelector('#users-body');
  state.users.forEach((user) => {
    const row = document.createElement('tr');
    const identity = document.createElement('td');
    identity.append(make('strong', '', user.displayName), make('small', '', user.email));
    const roleCell = document.createElement('td');
    const role = document.createElement('select');
    ['user', 'manager', 'admin'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value.toUpperCase();
      option.selected = user.role === value;
      role.append(option);
    });
    roleCell.append(role);
    const statusCell = document.createElement('td');
    const active = document.createElement('input');
    active.type = 'checkbox';
    active.checked = user.active;
    active.setAttribute('aria-label', `تفعيل ${user.email}`);
    statusCell.append(active);
    const actionCell = document.createElement('td');
    const save = make('button', 'button secondary compact', 'حفظ') as HTMLButtonElement;
    save.addEventListener('click', async () => {
      try {
        await updateUserAccess(user.id, role.value as Role, active.checked);
        setMessage('تم تحديث صلاحية المستخدم.', 'success');
      } catch (error) {
        setMessage(friendlyError(error), 'error');
      }
    });
    actionCell.append(save);
    row.append(identity, roleCell, statusCell, actionCell);
    usersBody?.append(row);
  });

  const invitesBody = view.querySelector('#invites-body');
  state.invites.forEach((invite) => {
    const row = document.createElement('tr');
    [invite.email, invite.role.toUpperCase(), invite.status].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    const action = document.createElement('td');
    const revoke = make('button', 'button danger compact', 'إلغاء') as HTMLButtonElement;
    revoke.disabled = invite.status !== 'pending';
    revoke.addEventListener('click', async () => {
      try {
        await revokeInvite(invite.email);
      } catch (error) {
        setMessage(friendlyError(error), 'error');
      }
    });
    action.append(revoke);
    row.append(action);
    invitesBody?.append(row);
  });

  view.querySelector<HTMLFormElement>('#invite-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const form = new FormData(formElement);
    try {
      await createInvite(String(form.get('email') ?? ''), String(form.get('role') ?? 'user') as Role, profile.id);
      formElement.reset();
      setMessage('تم إنشاء الدعوة. يمكن لصاحب البريد إنشاء حساب أو الدخول عبر Google.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
}

function renderImport(view: HTMLElement): void {
  const profile = state.session.profile;
  if (!profile || !canManageUsers(profile.role)) {
    view.append(make('p', 'notice error', 'هذه الصفحة متاحة للمدير فقط.'));
    return;
  }
  view.innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">نقل آمن</p><h2>استيراد البيانات القديمة</h2></div></section>
    <section class="panel import-panel">
      <p>اختر ملف JSON صُدّر من النسخة القديمة. ستُعرض معاينة قبل الكتابة، وتُستخدم بصمات ثابتة لمنع التكرار.</p>
      <label class="file-picker">ملف JSON<input id="import-file" type="file" accept="application/json,.json" /></label>
      <div id="import-preview" class="import-preview"></div>
      <button class="button primary" id="import-confirm" type="button" disabled>تأكيد الاستيراد</button>
    </section>
  `;
  const previewElement = view.querySelector<HTMLDivElement>('#import-preview');
  const confirmButton = view.querySelector<HTMLButtonElement>('#import-confirm');
  view.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !previewElement || !confirmButton) return;
    try {
      state.importPreview = previewLegacyImport(await file.text());
      previewElement.textContent = '';
      const values = [
        ['أخبار صالحة', state.importPreview.validNews],
        ['أخبار مرفوضة', state.importPreview.invalidNews],
        ['مصادر صالحة', state.importPreview.validSources],
        ['مصادر مرفوضة', state.importPreview.invalidSources],
      ] as const;
      values.forEach(([label, value]) => {
        const item = make('div');
        item.append(make('strong', '', String(value)), make('span', '', label));
        previewElement.append(item);
      });
      confirmButton.disabled = state.importPreview.validNews + state.importPreview.validSources === 0;
    } catch (error) {
      state.importPreview = null;
      confirmButton.disabled = true;
      previewElement.textContent = friendlyError(error);
    }
  });
  confirmButton?.addEventListener('click', async () => {
    if (!state.importPreview || !confirmButton) return;
    confirmButton.disabled = true;
    try {
      const result = await importLegacyData(state.importPreview, profile.id);
      setMessage(`تم استيراد ${result.news} خبر و${result.sources} مصدر.`, 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
      confirmButton.disabled = false;
    }
  });
}

function renderCurrentView(): void {
  const view = document.querySelector<HTMLElement>('#view');
  const title = document.querySelector<HTMLElement>('#page-title');
  if (!view || !title || !state.session.profile) return;
  state.route = routeFromHash();
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('data-route') === state.route);
  });
  view.textContent = '';
  const titles: Record<Route, string> = {
    dashboard: 'لوحة الرصد',
    news: 'الأخبار',
    sources: 'المصادر',
    users: 'المستخدمون',
    import: 'الاستيراد',
  };
  title.textContent = titles[state.route];
  if (state.error) {
    setMessage(state.error, 'error');
    state.error = '';
  }
  if (state.route === 'dashboard') renderDashboard(view);
  if (state.route === 'news') renderNews(view);
  if (state.route === 'sources') renderSources(view);
  if (state.route === 'users') renderUsers(view);
  if (state.route === 'import') renderImport(view);
  view.focus({ preventScroll: true });
}

function render(): void {
  if (state.loading) {
    renderLoading();
    return;
  }
  if (!state.session.user || !state.session.profile) {
    renderLogin();
    return;
  }
  renderShell();
  renderCurrentView();
}

window.addEventListener('hashchange', () => {
  state.route = routeFromHash();
  renderCurrentView();
  document.querySelector('.sidebar')?.classList.remove('open');
});

observeSession((session) => {
  const identityChanged = state.session.user?.uid !== session.user?.uid;
  state.session = session;
  state.loading = false;
  if (identityChanged || session.profile) subscribeToData();
  render();
});
