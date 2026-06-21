import './styles.css';
import type { Unsubscribe } from 'firebase/firestore';
import {
  loginWithGoogle,
  logout,
  observeSession,
  type Session,
} from './lib/auth';
import {
  createInvite,
  createNews,
  deleteNews,
  deleteSource,
  importanceLabels,
  revokeInvite,
  saveSource,
  subscribeInvites,
  subscribeNews,
  subscribeSources,
  subscribeSettings,
  subscribeSyncRuns,
  subscribeUsers,
  updateUserAccess,
  saveSettings,
} from './lib/data';
import { importLegacyData, previewLegacyImport, type ImportPreview } from './lib/migration';
import { canManageContent, canManageUsers } from './lib/permissions';
import { buildExportPayload } from './lib/export';
import { friendlyError } from './lib/errors';
import {
  subscribeAlerts,
  subscribeBookmarks,
  subscribeFetchLogs,
  subscribeGreyIntelligence,
  subscribeIntelligenceNews,
  subscribeIntelligenceReports,
  subscribeIntelligenceSources,
  subscribeRepositories,
  subscribeWatchlistHits,
  subscribeWatchlists,
} from './lib/intelligence-data';
import {
  renderAlerts,
  renderArabicIntelligenceHub,
  renderCommandCenter,
  renderGreyIntelligence,
  renderIntelligenceReports,
  renderRepositoryIntelligence,
  renderWatchlists,
  type IntelligenceUiState,
} from './intelligence-ui';
import type {
  AppSettings,
  ArabicIntelligenceReport,
  GreyIntelligenceItem,
  IntelligenceAlert,
  IntelligenceNewsItem,
  IntelligenceSource,
  Invite,
  NewsItem,
  NewsFetchLog,
  RepositoryIntelligenceItem,
  Role,
  Source,
  SyncRun,
  UserProfile,
  Watchlist,
  WatchlistHit,
} from './types';

type Route =
  | 'dashboard'
  | 'intelligence'
  | 'news'
  | 'grey-intel'
  | 'repositories/intelligence'
  | 'watchlists'
  | 'alerts'
  | 'reports'
  | 'archive'
  | 'sources'
  | 'users'
  | 'import'
  | 'settings';

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
  settings: AppSettings | null;
  intelligenceNews: IntelligenceNewsItem[];
  greyIntel: GreyIntelligenceItem[];
  intelligenceReports: ArabicIntelligenceReport[];
  intelligenceSources: IntelligenceSource[];
  repositories: RepositoryIntelligenceItem[];
  watchlists: Watchlist[];
  watchlistHits: WatchlistHit[];
  alerts: IntelligenceAlert[];
  fetchLogs: NewsFetchLog[];
  bookmarks: Set<string>;
  importPreview: ImportPreview | null;
  error: string;
  loading: boolean;
  guestMode: boolean;
  unsubscribers: Unsubscribe[];
} = {
  session: { user: null, profile: null, blockedReason: null },
  route: 'dashboard',
  news: [],
  sources: [],
  users: [],
  invites: [],
  syncRuns: [],
  settings: null,
  intelligenceNews: [],
  greyIntel: [],
  intelligenceReports: [],
  intelligenceSources: [],
  repositories: [],
  watchlists: [],
  watchlistHits: [],
  alerts: [],
  fetchLogs: [],
  bookmarks: new Set(),
  importPreview: null,
  error: '',
  loading: true,
  guestMode: false,
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
  return [
    'dashboard',
    'intelligence',
    'news',
    'grey-intel',
    'repositories/intelligence',
    'watchlists',
    'alerts',
    'reports',
    'archive',
    'sources',
    'users',
    'import',
    'settings',
  ].includes(route)
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

function clearSubscriptions(): void {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
}

function subscribeToData(): void {
  clearSubscriptions();
  if (state.guestMode) return;
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
    subscribeSettings((settings) => {
      state.settings = settings;
      renderCurrentView();
    }, onError),
    subscribeIntelligenceNews((items) => {
      state.intelligenceNews = items;
      renderCurrentView();
    }, onError),
    subscribeGreyIntelligence((items) => {
      state.greyIntel = items;
      renderCurrentView();
    }, onError),
    subscribeIntelligenceReports(state.session.profile.id, state.session.profile.role, (items) => {
      state.intelligenceReports = items;
      renderCurrentView();
    }, onError),
    subscribeIntelligenceSources((items) => {
      state.intelligenceSources = items;
      renderCurrentView();
    }, onError),
    subscribeRepositories((items) => {
      state.repositories = items;
      renderCurrentView();
    }, onError),
    subscribeWatchlists(state.session.profile.id, state.session.profile.role, (items) => {
      state.watchlists = items;
      renderCurrentView();
    }, onError),
    subscribeWatchlistHits((items) => {
      state.watchlistHits = items;
      renderCurrentView();
    }, onError),
    subscribeAlerts((items) => {
      state.alerts = items;
      renderCurrentView();
    }, onError),
    subscribeBookmarks(state.session.profile.id, (items) => {
      state.bookmarks = items;
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
      subscribeFetchLogs((items) => {
        state.fetchLogs = items;
        renderCurrentView();
      }, onError),
    );
  }
}

function enterGuestMode(): void {
  clearSubscriptions();
  state.guestMode = true;
  state.session = {
    user: null,
    profile: {
      id: 'guest-reader',
      email: 'guest@m3tm.app',
      displayName: 'زائر للقراءة',
      role: 'user',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    blockedReason: null,
  };
  state.route = 'dashboard';
  history.replaceState(null, '', '#/dashboard');
  render();
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
      <div class="login-map-bg" aria-hidden="true">
        <img src="/lovable-world-map.svg" alt="" />
      </div>
      <div class="login-gradient login-gradient-side" aria-hidden="true"></div>
      <div class="login-gradient login-gradient-bottom" aria-hidden="true"></div>
      <section class="login-brand" aria-labelledby="brand-title">
        <p class="login-command-label">مركز قيادة استخباري <span aria-hidden="true">♢</span></p>
        <h1 id="brand-title"><span>M3TM</span>.RASEED</h1>
        <h2>مركز الرصد العربي</h2>
        <p class="login-tagline">رصد. تحليل. تنبيه. تقرير.</p>
        <p class="login-description">منصة رصد وتحليل استخباري عربي لمتابعة الأخبار والمؤشرات والمخاطر والتنبيهات في الوقت الحقيقي عبر مناطق العالم.</p>
      </section>
      <section class="login-card" aria-labelledby="login-title">
        <div>
          <h2 id="login-title">الدخول إلى المنصة</h2>
          <p class="muted">سجّل الدخول للوصول إلى لوحة الرصد الاستخباري.</p>
        </div>
        ${blocked ? `<div class="notice error">${escapeStatic(blocked)}</div>` : ''}
        <button class="button google" id="google-login" type="button"><span>الدخول بحساب Google</span><b aria-hidden="true">G</b></button>
        <button class="button guest" id="guest-login" type="button"><span aria-hidden="true">‹</span><span>الدخول كزائر للقراءة فقط</span><b aria-hidden="true">◉</b></button>
        <p class="login-footnote">دخول الزائر للقراءة فقط، وتتم ترقية الصلاحيات من المالك.</p>
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
  document.querySelector('#guest-login')?.addEventListener('click', enterGuestMode);
}

function navButton(route: Route, label: string): string {
  const active = state.route === route ? 'active' : '';
  return `<a class="nav-link ${active}" href="#/${route}" data-route="${route}">${label}</a>`;
}

function renderShell(): void {
  const profile = state.session.profile;
  if (!profile) return;
  const unreadAlerts = state.alerts.filter((item) => !item.read).length;
  const guestLinks = state.guestMode
    ? `${navButton('dashboard', 'لوحة القيادة')}${navButton('news', 'الأخبار العربية')}${navButton('grey-intel', 'المصادر الرمادية')}${navButton('repositories/intelligence', 'ذكاء المستودعات')}`
    : '';
  const adminLinks = canManageUsers(profile.role)
    ? `<div class="nav-section">الإدارة</div>${navButton('sources', 'إدارة المصادر')}${navButton('users', 'المستخدمون')}${navButton('import', 'الاستيراد')}${navButton('settings', 'الإعدادات')}`
    : '';
  app.innerHTML = `
    <div class="app-shell ${state.guestMode ? 'lovable-locked-shell' : ''}">
      <aside class="sidebar">
        <a class="brand" href="#/intelligence" aria-label="M3TM.RASEED">
          <span class="brand-mark">M3</span>
          <span><strong>M3TM.RASEED</strong><small>مركز الرصد العربي</small></span>
        </a>
        <nav aria-label="التنقل الرئيسي">
          ${guestLinks || `
            ${navButton('dashboard', 'لوحة القيادة')}
            ${navButton('news', 'الأخبار العربية')}
            ${navButton('grey-intel', 'المصادر الرمادية')}
            <a class="nav-link topic-link" href="#/news" data-route="topic-gulf">الخليج وإيران</a>
            <a class="nav-link topic-link" href="#/news" data-route="topic-espionage">التجسس والاستخبارات</a>
            <a class="nav-link topic-link" href="#/news" data-route="topic-strikes">الضربات والهجمات</a>
            ${navButton('repositories/intelligence', 'ذكاء المستودعات')}
            ${navButton('watchlists', 'قوائم المراقبة')}
            ${navButton('alerts', `التنبيهات${unreadAlerts ? ` ${unreadAlerts}` : ''}`)}
            ${navButton('reports', 'التقارير التنفيذية')}
            ${adminLinks}
          `}
        </nav>
        <div class="sidebar-footer">
          <span class="role-badge">${state.guestMode ? 'READ ONLY' : escapeStatic(profile.role.toUpperCase())}</span>
          <strong>${escapeStatic(profile.displayName)}</strong>
          <small>${escapeStatic(profile.email)}</small>
          <button class="button text light" id="logout-button" type="button">${state.guestMode ? 'الخروج من وضع الزائر' : 'تسجيل الخروج'}</button>
        </div>
      </aside>
      <div class="workspace" data-route="${escapeStatic(state.route)}">
        <header class="topbar">
          ${state.guestMode ? '<button class="guest-role-switch" type="button">زائر (قراءة فقط)⌄</button>' : ''}
          <button class="menu-button" id="menu-button" type="button" aria-label="فتح القائمة">☰</button>
          <div>
            <p class="system-label">${state.guestMode ? 'رصد استخباري في الوقت الحقيقي للأحداث والمخاطر العالمية' : 'M3TM.RASEED'}</p>
            <h1 id="page-title">${state.guestMode ? 'لوحة الرصد الاستخباري' : 'لوحة الرصد'}</h1>
          </div>
          <div class="topbar-actions">
            <label class="topbar-search">
              <span>بحث</span>
              <input type="search" placeholder="ابحث في الأخبار والمؤشرات..." aria-label="بحث عام" />
            </label>
            <div class="live-status"><span></span> المزامنة نشطة</div>
            <a class="notification-button" href="#/alerts" aria-label="التنبيهات">جرس التنبيهات${unreadAlerts ? `<strong>${unreadAlerts}</strong>` : ''}</a>
            <div class="admin-chip"><span>${escapeStatic(profile.role.toUpperCase())}</span><small>${escapeStatic(profile.displayName)}</small></div>
            <button class="button secondary compact" id="export-button" type="button">تصدير JSON</button>
          </div>
        </header>
        <span class="build-marker">M3TM_UI_VERSION=command-center-v3</span>
        <div id="global-message" class="notice" hidden></div>
        <main id="view" tabindex="-1"></main>
      </div>
    </div>
  `;
  document.querySelector('#logout-button')?.addEventListener('click', () => {
    if (state.guestMode) {
      state.guestMode = false;
      state.session = { user: null, profile: null, blockedReason: null };
      history.replaceState(null, '', location.pathname);
      render();
      return;
    }
    void logout();
  });
  document.querySelector('#export-button')?.addEventListener('click', exportData);
  document.querySelector('#menu-button')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
  });
}

function exportData(): void {
  const payload = buildExportPayload(state.news, state.sources);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `m3tm-rased-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
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
  if (state.guestMode) {
    renderGuestDashboard(view);
    return;
  }
  renderCommandCenter(view, intelligenceUiState(profile), setMessage);
}

function renderGuestDashboard(view: HTMLElement): void {
  const events = [
    ['إعلامي', 'تحركات بحرية مكثفة قرب مضيق هرمز', 'مصادر إعلامية إقليمية تتداول نشاطًا بحريًا متزايدًا.', 'وكالة الرصد الإقليمي', 'إيران', 'قبل ٣ دقيقة'],
    ['مرتفع', 'هجوم سيبراني على بنية تحتية مالية', 'محاولة اختراق منسقة تستهدف أنظمة دفع إقليمية.', 'مركز الأمن السيبراني', 'الإمارات', 'قبل ٤ دقيقة'],
    ['مرتفع', 'إشارة أمنية في مستودع برمجي مفتوح', 'اكتشاف اعتمادية شائعة منخفضة التحديث ضمن مشروع مفتوح.', 'محرك ذكاء المستودعات', 'الولايات المتحدة', 'قبل ساعة'],
    ['متوسط', 'نشاط دبلوماسي حول ملف إقليمي', 'مباحثات مكثفة بين عواصم إقليمية بشأن أمن الطاقة.', 'مصدر سياسي', 'الخليج', 'قبل ساعتين'],
  ];
  view.innerHTML = `
    <section class="lovable-dashboard" aria-label="لوحة الرصد الاستخباري">
      <header class="lovable-dashboard-title">
        <h2>لوحة الرصد الاستخباري</h2>
        <p>رصد. تحليل. تنبيه. تقرير.</p>
      </header>
      <section class="lovable-kpis" aria-label="مؤشرات الرصد">
        <article><span>أحداث نشطة</span><strong>٨</strong><i>⌁</i></article>
        <article class="critical"><span>مخاطر حرجة</span><strong>١</strong><i>◎</i></article>
        <article class="high"><span>مخاطر مرتفعة</span><strong>٣</strong><i>△</i></article>
        <article class="success"><span>مصادر فعالة</span><strong>٥</strong><i>◉</i></article>
        <article class="repo"><span>ذكاء المستودعات</span><strong>٣</strong><i>⌘</i></article>
      </section>
      <section class="lovable-dashboard-grid">
        <aside class="lovable-investigation-panel">
          <h3>تحقيق الأحداث</h3>
          <div class="lovable-event-list">
            ${events.map(([risk, title, summary, source, region, time]) => `
              <article class="lovable-event-card">
                <div><time>◷ ${time}</time><span class="${risk === 'مرتفع' ? 'high' : risk === 'متوسط' ? 'medium' : 'media'}">${risk}</span></div>
                <h4>${title}</h4>
                <p>${summary}</p>
                <footer><small>${source}</small><small>⌖ ${region}</small><a href="#/dashboard">عرض التفاصيل ‹</a></footer>
              </article>
            `).join('')}
          </div>
        </aside>
        <article class="lovable-map-panel">
          <div class="lovable-panel-heading">
            <span>◎</span>
            <div><h3>خريطة الأحداث العالمية</h3><p>رصد حي للمؤشرات والأحداث حسب المنطقة والخطورة</p></div>
          </div>
          <nav class="lovable-risk-tabs" aria-label="تصفية الخريطة">
            <span class="active">خريطة</span><span>كرة أرضية</span><span>الكل</span><span>حرج</span><span>مرتفع</span><span>متوسط</span><span>منخفض</span><span>إعلامي</span>
          </nav>
          <div class="lovable-map-stage" role="img" aria-label="خريطة الأحداث العالمية">
            <div class="lovable-spinner" aria-hidden="true"></div>
            <p>جاري تحميل الخريطة...</p>
          </div>
        </article>
      </section>
    </section>
  `;
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
              <label>التصنيف<input name="category" value="${escapeStatic(state.settings?.defaultCategory || 'عام')}" maxlength="80" /></label>
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

function intelligenceUiState(profile: UserProfile): IntelligenceUiState {
  return {
    userId: profile.id,
    role: profile.role,
    news: state.intelligenceNews,
    sources: state.intelligenceSources,
    repositories: state.repositories,
    watchlists: state.watchlists,
    hits: state.watchlistHits,
    alerts: state.alerts,
    fetchLogs: state.fetchLogs,
    bookmarks: state.bookmarks,
    greyIntel: state.greyIntel,
    reports: state.intelligenceReports,
  };
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
              <label>التصنيف<input name="category" value="${escapeStatic(state.settings?.defaultCategory || 'عام')}" maxlength="80" /></label>
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

function renderSettings(view: HTMLElement): void {
  const profile = state.session.profile;
  if (!profile || !canManageUsers(profile.role)) {
    view.append(make('p', 'notice error', 'هذه الصفحة متاحة للمدير فقط.'));
    return;
  }
  const settings = state.settings;
  view.innerHTML = `
    <section class="page-heading">
      <div><p class="eyebrow">تهيئة المنصة</p><h2>الإعدادات العامة</h2></div>
    </section>
    <section class="panel settings-panel">
      <form id="settings-form" class="form-grid">
        <label>اسم المنصة
          <input name="platformName" value="${escapeStatic(settings?.platformName || 'M3TM.RASEED')}" maxlength="80" required />
        </label>
        <label>التصنيف الافتراضي
          <input name="defaultCategory" value="${escapeStatic(settings?.defaultCategory || 'عام')}" maxlength="80" required />
        </label>
        <label class="toggle wide">
          <input name="feedSyncEnabled" type="checkbox" ${settings?.feedSyncEnabled !== false ? 'checked' : ''} />
          <span>تمكين مزامنة RSS وAtom المجدولة</span>
        </label>
        <p class="muted wide">عند تعطيل المزامنة، تنتهي مهمة GitHub Actions بنجاح دون جلب المصادر أو تعديلها.</p>
        <button class="button primary compact" type="submit">حفظ الإعدادات</button>
      </form>
    </section>
  `;
  view.querySelector<HTMLFormElement>('#settings-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const values = new FormData(formElement);
    try {
      await saveSettings({
        platformName: String(values.get('platformName') ?? 'M3TM.RASEED'),
        defaultCategory: String(values.get('defaultCategory') ?? 'عام'),
        feedSyncEnabled: values.get('feedSyncEnabled') === 'on',
        updatedBy: profile.id,
      });
      setMessage('تم حفظ الإعدادات.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
}

function renderCurrentView(): void {
  const view = document.querySelector<HTMLElement>('#view');
  const title = document.querySelector<HTMLElement>('#page-title');
  if (!view || !title || !state.session.profile) return;
  state.route = routeFromHash();
  if (state.guestMode && !['dashboard', 'news', 'grey-intel', 'repositories/intelligence'].includes(state.route)) {
    state.route = 'dashboard';
    history.replaceState(null, '', '#/dashboard');
  }
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('data-route') === state.route);
  });
  view.textContent = '';
  const titles: Record<Route, string> = {
    dashboard: 'لوحة القيادة',
    intelligence: 'مركز الرصد العربي',
    news: 'الأخبار العربية',
    'grey-intel': 'المصادر الرمادية والتسريبات',
    'repositories/intelligence': 'ذكاء المستودعات',
    watchlists: 'قوائم المراقبة',
    alerts: 'التنبيهات',
    reports: 'التقارير التنفيذية',
    archive: 'الأرشيف القديم',
    sources: 'المصادر',
    users: 'المستخدمون',
    import: 'الاستيراد',
    settings: 'الإعدادات',
  };
  title.textContent = state.guestMode && state.route === 'dashboard' ? 'لوحة الرصد الاستخباري' : titles[state.route];
  if (state.error) {
    setMessage(state.error, 'error');
    state.error = '';
  }
  if (state.route === 'dashboard') renderDashboard(view);
  const intelligenceState = intelligenceUiState(state.session.profile);
  if (state.route === 'intelligence') renderArabicIntelligenceHub(view, intelligenceState, setMessage);
  if (state.route === 'news') renderCommandCenter(view, intelligenceState, setMessage);
  if (state.route === 'grey-intel') renderGreyIntelligence(view, intelligenceState, setMessage);
  if (state.route === 'repositories/intelligence') renderRepositoryIntelligence(view, intelligenceState, setMessage);
  if (state.route === 'watchlists') renderWatchlists(view, intelligenceState, setMessage);
  if (state.route === 'alerts') renderAlerts(view, intelligenceState, setMessage);
  if (state.route === 'reports') renderIntelligenceReports(view, intelligenceState);
  if (state.route === 'archive') renderNews(view);
  if (state.route === 'sources') renderSources(view);
  if (state.route === 'users') renderUsers(view);
  if (state.route === 'import') renderImport(view);
  if (state.route === 'settings') renderSettings(view);
  view.focus({ preventScroll: true });
}

function render(): void {
  if (state.loading) {
    renderLoading();
    return;
  }
  if ((!state.session.user && !state.guestMode) || !state.session.profile) {
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
  if (state.guestMode && !session.user) return;
  if (session.user) state.guestMode = false;
  const identityChanged = state.session.user?.uid !== session.user?.uid;
  state.session = session;
  state.loading = false;
  if (identityChanged || session.profile) subscribeToData();
  render();
});
