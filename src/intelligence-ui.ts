import { canManageContent } from './lib/permissions';
import { friendlyError } from './lib/errors';
import {
  createReportFromNews,
  createTaskFromItem,
  deleteIntelligenceSource,
  deleteWatchlist,
  markAlertRead,
  markAllAlertsRead,
  requestIntelligenceRefresh,
  saveIntelligenceSource,
  saveRepository,
  saveWatchlist,
  summarizeNewsItem,
  toggleNewsBookmark,
} from './lib/intelligence-data';
import type {
  IntelligenceAlert,
  IntelligenceNewsItem,
  IntelligenceProvider,
  IntelligenceSource,
  NewsFetchLog,
  RepositoryIntelligenceItem,
  Role,
  Watchlist,
  WatchlistHit,
} from './types';

export interface IntelligenceUiState {
  userId: string;
  role: Role;
  news: IntelligenceNewsItem[];
  sources: IntelligenceSource[];
  repositories: RepositoryIntelligenceItem[];
  watchlists: Watchlist[];
  hits: WatchlistHit[];
  alerts: IntelligenceAlert[];
  fetchLogs: NewsFetchLog[];
  bookmarks: Set<string>;
}

type Message = (message: string, type?: 'success' | 'error' | 'info') => void;

function element(tag: string, className = '', text = ''): HTMLElement {
  const item = document.createElement(tag);
  item.className = className;
  item.textContent = text;
  return item;
}

function formatDate(value: unknown): string {
  const timestamp = value as { toDate?: () => Date };
  const date = typeof timestamp?.toDate === 'function' ? timestamp.toDate() : new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'غير معروف';
  return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function csv(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(/[,،\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function providerLabel(provider: IntelligenceProvider): string {
  const labels: Record<IntelligenceProvider, string> = {
    rss: 'RSS',
    gdelt: 'GDELT',
    hackernews: 'Hacker News',
    github: 'GitHub',
    newsapi: 'NewsAPI',
    custom: 'مخصص',
  };
  return labels[provider];
}

function scoreClass(score: number): string {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function buildNewsReport(items: IntelligenceNewsItem[]): string {
  return items
    .map(
      (item, index) =>
        `## ${index + 1}. ${item.title}\n\n- المصدر: ${item.source}\n- التصنيف: ${item.category}\n- الدرجة: ${item.score}/100\n- الرابط: ${item.url}\n\n${item.summary || item.contentSnippet}`,
    )
    .join('\n\n---\n\n');
}

function newsCard(
  item: IntelligenceNewsItem,
  state: IntelligenceUiState,
  setMessage: Message,
  selected: Set<string>,
): HTMLElement {
  const card = element('article', 'intel-card');
  const header = element('div', 'intel-card-header');
  const score = element('span', `score-badge ${scoreClass(item.score)}`, `${item.score}`);
  const identity = element('div', 'intel-card-identity');
  identity.append(
    element('span', 'provider-badge', providerLabel(item.provider)),
    element('span', '', item.source),
    element('span', '', item.category),
  );
  header.append(identity, score);

  const title = element('h3', '', item.title);
  const summary = element('p', 'intel-summary', item.summary || item.contentSnippet || 'لا يوجد ملخص متاح.');
  const tags = element('div', 'tag-list');
  item.tags.slice(0, 8).forEach((tag) => tags.append(element('span', '', tag)));

  const details = document.createElement('details');
  details.className = 'intel-details';
  const detailsSummary = document.createElement('summary');
  detailsSummary.textContent = 'التفاصيل والكيانات';
  const entityText = [
    ...item.entities.cves,
    ...item.entities.domains,
    ...item.entities.technologies,
    ...item.entities.githubRepos,
  ].slice(0, 20);
  details.append(
    detailsSummary,
    element('p', 'muted', entityText.length ? entityText.join(' · ') : 'لم تُستخرج كيانات واضحة.'),
  );

  const footer = element('div', 'intel-card-footer');
  footer.append(element('small', '', formatDate(item.publishedAt)));
  const actions = element('div', 'intel-actions');

  const selectLabel = document.createElement('label');
  selectLabel.className = 'select-item';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = selected.has(item.id);
  checkbox.setAttribute('aria-label', `تحديد ${item.title}`);
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selected.add(item.id);
    else selected.delete(item.id);
  });
  selectLabel.append(checkbox, document.createTextNode('تحديد'));
  actions.append(selectLabel);

  if (item.url) {
    const open = element('a', 'button secondary compact', 'فتح المصدر') as HTMLAnchorElement;
    open.href = item.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    actions.append(open);
  }

  const bookmarked = state.bookmarks.has(item.id);
  const bookmark = element('button', 'button secondary compact', bookmarked ? 'إزالة الحفظ' : 'حفظ') as HTMLButtonElement;
  bookmark.type = 'button';
  bookmark.addEventListener('click', async () => {
    try {
      await toggleNewsBookmark(item.id, state.userId, !bookmarked);
      setMessage(bookmarked ? 'أزيل الخبر من المحفوظات.' : 'حُفظ الخبر.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
  actions.append(bookmark);

  if (canManageContent(state.role)) {
    const summarize = element('button', 'button secondary compact', 'تلخيص') as HTMLButtonElement;
    summarize.type = 'button';
    summarize.addEventListener('click', async () => {
      try {
        await summarizeNewsItem(item);
        setMessage('تم تحديث الملخص الاستخباري.', 'success');
      } catch (error) {
        setMessage(friendlyError(error), 'error');
      }
    });
    actions.append(summarize);
  }

  const task = element('button', 'button secondary compact', 'إنشاء مهمة') as HTMLButtonElement;
  task.type = 'button';
  task.addEventListener('click', async () => {
    try {
      await createTaskFromItem({
        title: `متابعة: ${item.title}`,
        description: item.summary || item.contentSnippet,
        sourceType: 'news',
        sourceIds: [item.id],
        createdBy: state.userId,
      });
      setMessage('تم إنشاء المهمة.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
  actions.append(task);

  const report = element('button', 'button primary compact', 'إنشاء تقرير') as HTMLButtonElement;
  report.type = 'button';
  report.addEventListener('click', async () => {
    try {
      await createReportFromNews({
        title: `تقرير: ${item.title}`,
        format: 'markdown',
        newsIds: [item.id],
        repositoryIds: [],
        content: buildNewsReport([item]),
        createdBy: state.userId,
      });
      setMessage('تم إنشاء مسودة التقرير.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
  actions.append(report);
  footer.append(actions);
  card.append(header, title, summary, tags, details, footer);
  return card;
}

function renderSourceAdmin(
  parent: HTMLElement,
  state: IntelligenceUiState,
  setMessage: Message,
): void {
  if (!canManageContent(state.role)) return;
  const details = document.createElement('details');
  details.className = 'panel editor intelligence-source-admin';
  const summary = document.createElement('summary');
  summary.textContent = 'إدارة مصادر الاستخبارات';
  details.append(summary);
  const form = document.createElement('form');
  form.className = 'form-grid';
  form.innerHTML = `
    <input name="id" type="hidden" />
    <label>الاسم<input name="name" required maxlength="160" /></label>
    <label>المزود<select name="provider">
      <option value="rss">RSS / Atom</option><option value="gdelt">GDELT</option>
      <option value="hackernews">Hacker News</option><option value="github">GitHub</option>
      <option value="newsapi">NewsAPI</option><option value="custom">مخصص</option>
    </select></label>
    <label class="wide">الرابط<input name="url" type="url" required /></label>
    <label>الاستعلام<input name="query" maxlength="300" /></label>
    <label>التصنيف<input name="category" value="Cybersecurity" maxlength="100" /></label>
    <label>اللغة<input name="language" value="en" maxlength="12" /></label>
    <label>الأولوية<input name="priority" type="number" min="0" max="100" value="75" /></label>
    <label>الفاصل بالدقائق<input name="interval" type="number" min="15" max="1440" value="60" /></label>
    <label class="toggle wide"><input name="enabled" type="checkbox" checked /><span>مصدر مفعّل</span></label>
    <div class="card-actions wide"><button class="button primary compact" type="submit">حفظ المصدر</button>
    <button class="button secondary compact" id="intel-source-cancel" type="button">إلغاء</button></div>
  `;
  details.append(form);

  const list = element('div', 'source-grid intelligence-source-list');
  state.sources.forEach((source) => {
    const card = element('article', 'source-card');
    const heading = element('div', 'source-heading');
    heading.append(
      element('h3', '', source.name),
      element('span', `source-state ${source.enabled ? 'active' : 'paused'}`, source.enabled ? 'active' : 'paused'),
    );
    card.append(
      heading,
      element('p', '', `${providerLabel(source.provider)} · ${source.category} · أولوية ${source.priority}`),
      element('small', '', `آخر جلب: ${formatDate(source.lastFetchedAt)}`),
    );
    if (source.lastError) card.append(element('p', 'inline-error', source.lastError));
    const actions = element('div', 'card-actions');
    const edit = element('button', 'button secondary compact', 'تعديل') as HTMLButtonElement;
    edit.type = 'button';
    edit.addEventListener('click', () => {
      (form.elements.namedItem('id') as HTMLInputElement).value = source.id;
      (form.elements.namedItem('name') as HTMLInputElement).value = source.name;
      (form.elements.namedItem('provider') as HTMLSelectElement).value = source.provider;
      (form.elements.namedItem('url') as HTMLInputElement).value = source.url;
      (form.elements.namedItem('query') as HTMLInputElement).value = source.query || '';
      (form.elements.namedItem('category') as HTMLInputElement).value = source.category;
      (form.elements.namedItem('language') as HTMLInputElement).value = source.language;
      (form.elements.namedItem('priority') as HTMLInputElement).value = String(source.priority);
      (form.elements.namedItem('interval') as HTMLInputElement).value = String(source.fetchIntervalMinutes);
      (form.elements.namedItem('enabled') as HTMLInputElement).checked = source.enabled;
      details.open = true;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const remove = element('button', 'button danger compact', 'حذف') as HTMLButtonElement;
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!confirm('هل تريد حذف مصدر الاستخبارات؟')) return;
      try {
        await deleteIntelligenceSource(source.id, state.userId);
        setMessage('تم حذف المصدر.', 'success');
      } catch (error) {
        setMessage(friendlyError(error), 'error');
      }
    });
    actions.append(edit, remove);
    card.append(actions);
    list.append(card);
  });
  details.append(list);
  parent.append(details);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    try {
      await saveIntelligenceSource(String(values.get('id') || '') || null, {
        name: String(values.get('name') || ''),
        provider: String(values.get('provider') || 'rss') as IntelligenceProvider,
        url: String(values.get('url') || ''),
        query: String(values.get('query') || ''),
        category: String(values.get('category') || 'General'),
        language: String(values.get('language') || 'en'),
        priority: Number(values.get('priority') || 75),
        enabled: values.get('enabled') === 'on',
        fetchIntervalMinutes: Number(values.get('interval') || 60),
        createdBy: state.userId,
      });
      form.reset();
      setMessage('تم حفظ مصدر الاستخبارات.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
  form.querySelector('#intel-source-cancel')?.addEventListener('click', () => form.reset());
}

export function renderNewsIntelligence(
  view: HTMLElement,
  state: IntelligenceUiState,
  setMessage: Message,
): void {
  view.innerHTML = `
    <section class="page-heading">
      <div><p class="eyebrow">NEWS INTELLIGENCE HUB</p><h2>مركز الأخبار والاستخبارات</h2>
      <p class="muted">رصد متعدد المصادر مع تقييم وكيانات وتقارير قابلة للتنفيذ.</p></div>
      ${canManageContent(state.role) ? '<button class="button primary compact" id="intelligence-refresh" type="button">طلب تحديث شامل</button>' : ''}
    </section>
    <section class="intel-metrics">
      <article><span>العناصر</span><strong>${state.news.length}</strong></article>
      <article><span>عالية الأهمية</span><strong>${state.news.filter((item) => item.score >= 75).length}</strong></article>
      <article><span>المحفوظة</span><strong>${state.bookmarks.size}</strong></article>
      <article><span>المصادر النشطة</span><strong>${state.sources.filter((item) => item.enabled).length}</strong></article>
    </section>
    <section class="panel intel-filter-panel">
      <div class="intel-filters">
        <label>بحث<input id="intel-search" type="search" placeholder="CVE، OSINT، شركة، تقنية..." /></label>
        <label>التصنيف<select id="intel-category"><option value="">الكل</option></select></label>
        <label>المزود<select id="intel-provider"><option value="">الكل</option></select></label>
        <label>الحد الأدنى<input id="intel-score" type="number" min="0" max="100" value="0" /></label>
        <label class="toggle"><input id="intel-bookmarked" type="checkbox" /><span>المحفوظة فقط</span></label>
      </div>
      <div class="card-actions"><button class="button secondary compact" id="bulk-report" type="button">تقرير من المحدد</button>
      <span id="intel-result-count" class="muted"></span></div>
    </section>
    <section id="intelligence-results" class="intel-grid"></section>
  `;

  renderSourceAdmin(view, state, setMessage);
  const selected = new Set<string>();
  const category = view.querySelector<HTMLSelectElement>('#intel-category');
  const provider = view.querySelector<HTMLSelectElement>('#intel-provider');
  [...new Set(state.news.map((item) => item.category))].sort().forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    category?.append(option);
  });
  [...new Set(state.news.map((item) => item.provider))].sort().forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = providerLabel(value);
    provider?.append(option);
  });

  const draw = () => {
    const container = view.querySelector('#intelligence-results');
    if (!container) return;
    const search = view.querySelector<HTMLInputElement>('#intel-search')?.value.trim().toLowerCase() || '';
    const selectedCategory = category?.value || '';
    const selectedProvider = provider?.value || '';
    const minScore = Number(view.querySelector<HTMLInputElement>('#intel-score')?.value || 0);
    const bookmarksOnly = view.querySelector<HTMLInputElement>('#intel-bookmarked')?.checked || false;
    const items = state.news.filter((item) => {
      const haystack = `${item.title} ${item.summary} ${item.contentSnippet} ${item.source} ${item.tags.join(' ')}`.toLowerCase();
      return (!search || haystack.includes(search))
        && (!selectedCategory || item.category === selectedCategory)
        && (!selectedProvider || item.provider === selectedProvider)
        && item.score >= minScore
        && (!bookmarksOnly || state.bookmarks.has(item.id));
    });
    container.textContent = '';
    items.forEach((item) => container.append(newsCard(item, state, setMessage, selected)));
    if (!items.length) container.append(element('p', 'empty panel', 'لا توجد نتائج مطابقة للفلاتر الحالية.'));
    const count = view.querySelector('#intel-result-count');
    if (count) count.textContent = `${items.length} نتيجة`;
  };
  view.querySelectorAll('#intel-search, #intel-category, #intel-provider, #intel-score, #intel-bookmarked')
    .forEach((control) => control.addEventListener('input', draw));
  draw();

  view.querySelector('#intelligence-refresh')?.addEventListener('click', async () => {
    try {
      await requestIntelligenceRefresh(state.userId);
      setMessage('تم تسجيل طلب التحديث. ستعالجه دورة المزامنة التالية.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
  view.querySelector('#bulk-report')?.addEventListener('click', async () => {
    const items = state.news.filter((item) => selected.has(item.id));
    if (!items.length) {
      setMessage('حدد خبرًا واحدًا على الأقل.', 'error');
      return;
    }
    try {
      await createReportFromNews({
        title: `تقرير استخباري مجمع - ${new Date().toLocaleDateString('ar-SA')}`,
        format: 'markdown',
        newsIds: items.map((item) => item.id),
        repositoryIds: [],
        content: buildNewsReport(items),
        createdBy: state.userId,
      });
      setMessage(`تم إنشاء تقرير من ${items.length} عناصر.`, 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
}

export function renderRepositoryIntelligence(
  view: HTMLElement,
  state: IntelligenceUiState,
  setMessage: Message,
): void {
  view.innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">REPOSITORY INTELLIGENCE</p>
      <h2>ذكاء المستودعات العامة</h2><p class="muted">أفكار معمارية ومنتجات مفتوحة المصدر دون نسخ شفرة غير مرخصة.</p></div></section>
    <section class="panel intel-filter-panel">
      <div class="intel-filters repo-filters">
        <label>بحث<input id="repo-search" type="search" placeholder="OSINT، FastAPI، MISP..." /></label>
        <label>اللغة<select id="repo-language"><option value="">كل اللغات</option></select></label>
        <label>الحد الأدنى للنجوم<input id="repo-stars" type="number" min="0" value="0" /></label>
        <label>الحد الأدنى للصلة<input id="repo-score" type="number" min="0" max="100" value="0" /></label>
      </div>
    </section>
    <section id="repository-results" class="intel-grid"></section>
  `;
  const languages = view.querySelector<HTMLSelectElement>('#repo-language');
  [...new Set(state.repositories.map((item) => item.language).filter(Boolean))].sort().forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    languages?.append(option);
  });
  const draw = () => {
    const container = view.querySelector('#repository-results');
    if (!container) return;
    const search = view.querySelector<HTMLInputElement>('#repo-search')?.value.toLowerCase() || '';
    const language = languages?.value || '';
    const stars = Number(view.querySelector<HTMLInputElement>('#repo-stars')?.value || 0);
    const score = Number(view.querySelector<HTMLInputElement>('#repo-score')?.value || 0);
    const items = state.repositories.filter((item) =>
      `${item.fullName} ${item.description} ${item.topics.join(' ')}`.toLowerCase().includes(search)
      && (!language || item.language === language)
      && item.stars >= stars
      && item.score >= score,
    );
    container.textContent = '';
    items.forEach((item) => {
      const card = element('article', 'intel-card repo-card');
      const header = element('div', 'intel-card-header');
      header.append(element('span', 'provider-badge', item.language || 'غير محدد'), element('span', `score-badge ${scoreClass(item.score)}`, String(item.score)));
      card.append(header, element('h3', '', item.fullName), element('p', 'intel-summary', item.description || 'لا يوجد وصف.'));
      const metrics = element('div', 'repo-metrics');
      metrics.append(element('span', '', `★ ${item.stars}`), element('span', '', `⑂ ${item.forks}`), element('span', '', `Issues ${item.openIssues}`), element('span', '', item.license));
      card.append(metrics);
      const ideas = document.createElement('ul');
      ideas.className = 'idea-list';
      item.usefulIdeas.forEach((idea) => ideas.append(element('li', '', idea)));
      card.append(ideas);
      const actions = element('div', 'intel-actions');
      const open = element('a', 'button secondary compact', 'فتح GitHub') as HTMLAnchorElement;
      open.href = item.url;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      actions.append(open);
      if (canManageContent(state.role)) {
        const save = element('button', 'button secondary compact', item.saved ? 'إلغاء الحفظ' : 'حفظ') as HTMLButtonElement;
        save.addEventListener('click', async () => {
          try {
            await saveRepository(item.id, !item.saved);
            setMessage('تم تحديث حالة المستودع.', 'success');
          } catch (error) {
            setMessage(friendlyError(error), 'error');
          }
        });
        actions.append(save);
      }
      const task = element('button', 'button primary compact', 'إنشاء مهمة') as HTMLButtonElement;
      task.addEventListener('click', async () => {
        try {
          await createTaskFromItem({
            title: `تحليل مستودع: ${item.fullName}`,
            description: `${item.description}\n\n${item.usefulIdeas.join('\n')}`,
            sourceType: 'repository',
            sourceIds: [item.id],
            createdBy: state.userId,
          });
          setMessage('تم إنشاء مهمة تحليل المستودع.', 'success');
        } catch (error) {
          setMessage(friendlyError(error), 'error');
        }
      });
      actions.append(task);
      card.append(actions);
      container.append(card);
    });
    if (!items.length) container.append(element('p', 'empty panel', 'لا توجد مستودعات مطابقة. شغّل مزود GitHub أولًا.'));
  };
  view.querySelectorAll('#repo-search, #repo-language, #repo-stars, #repo-score')
    .forEach((control) => control.addEventListener('input', draw));
  draw();
}

export function renderWatchlists(
  view: HTMLElement,
  state: IntelligenceUiState,
  setMessage: Message,
): void {
  view.innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">WATCHLISTS</p><h2>قوائم المراقبة</h2>
      <p class="muted">راقب الكلمات والكيانات والثغرات والمستودعات تلقائيًا.</p></div></section>
    <section class="panel">
      <form id="watchlist-form" class="form-grid">
        <input name="id" type="hidden" />
        <label>الاسم<input name="name" required maxlength="160" /></label>
        <label>النوع<select name="type"><option value="mixed">أخبار ومستودعات</option><option value="news">أخبار</option><option value="repository">مستودعات</option></select></label>
        <label class="wide">الكلمات المفتاحية<textarea name="keywords" rows="3" placeholder="CVE, شركة, نطاق, تقنية"></textarea></label>
        <label class="wide">الكيانات<textarea name="entities" rows="2" placeholder="example.com, CVE-2026-1234"></textarea></label>
        <label class="toggle"><input name="enabled" type="checkbox" checked /><span>مفعلة</span></label>
        <label class="toggle"><input name="telegram" type="checkbox" /><span>Telegram-ready</span></label>
        <button class="button primary compact" type="submit">حفظ القائمة</button>
      </form>
    </section>
    <section class="watchlist-layout"><div id="watchlist-list" class="watchlist-list"></div>
      <article class="panel"><div class="panel-heading"><h3>أحدث التطابقات</h3><span>${state.hits.length}</span></div><div id="watchlist-hits" class="compact-list"></div></article>
    </section>
  `;
  const form = view.querySelector<HTMLFormElement>('#watchlist-form');
  const list = view.querySelector('#watchlist-list');
  state.watchlists.forEach((watchlist) => {
    const card = element('article', 'panel watchlist-card');
    const heading = element('div', 'panel-heading');
    heading.append(element('h3', '', watchlist.name), element('span', `source-state ${watchlist.enabled ? 'active' : 'paused'}`, watchlist.enabled ? 'active' : 'paused'));
    const tags = element('div', 'tag-list');
    [...watchlist.keywords, ...watchlist.entities].slice(0, 12).forEach((tag) => tags.append(element('span', '', tag)));
    const actions = element('div', 'card-actions');
    const edit = element('button', 'button secondary compact', 'تعديل') as HTMLButtonElement;
    edit.addEventListener('click', () => {
      if (!form) return;
      (form.elements.namedItem('id') as HTMLInputElement).value = watchlist.id;
      (form.elements.namedItem('name') as HTMLInputElement).value = watchlist.name;
      (form.elements.namedItem('type') as HTMLSelectElement).value = watchlist.type;
      (form.elements.namedItem('keywords') as HTMLTextAreaElement).value = watchlist.keywords.join(', ');
      (form.elements.namedItem('entities') as HTMLTextAreaElement).value = watchlist.entities.join(', ');
      (form.elements.namedItem('enabled') as HTMLInputElement).checked = watchlist.enabled;
      (form.elements.namedItem('telegram') as HTMLInputElement).checked = watchlist.notifyChannels.includes('telegram');
      form.scrollIntoView({ behavior: 'smooth' });
    });
    const remove = element('button', 'button danger compact', 'حذف') as HTMLButtonElement;
    remove.addEventListener('click', async () => {
      if (!confirm('هل تريد حذف قائمة المراقبة؟')) return;
      try {
        await deleteWatchlist(watchlist.id);
      } catch (error) {
        setMessage(friendlyError(error), 'error');
      }
    });
    actions.append(edit, remove);
    card.append(heading, tags, actions);
    list?.append(card);
  });
  if (!state.watchlists.length) list?.append(element('p', 'empty panel', 'لا توجد قوائم مراقبة بعد.'));

  const hits = view.querySelector('#watchlist-hits');
  state.hits.slice(0, 30).forEach((hit) => {
    const row = element('div', 'compact-row');
    const body = element('div');
    body.append(element('strong', '', hit.matchedKeywords.join(' · ')), element('small', '', hit.matchedText));
    row.append(body, element('span', `score-badge ${scoreClass(hit.score)}`, String(hit.score)));
    hits?.append(row);
  });
  if (!state.hits.length) hits?.append(element('p', 'empty', 'لم تُسجل تطابقات بعد.'));

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    try {
      await saveWatchlist(String(values.get('id') || '') || null, {
        name: String(values.get('name') || ''),
        type: String(values.get('type') || 'mixed') as Watchlist['type'],
        keywords: csv(values.get('keywords')),
        entities: csv(values.get('entities')),
        enabled: values.get('enabled') === 'on',
        notifyChannels: values.get('telegram') === 'on' ? ['dashboard', 'telegram'] : ['dashboard'],
        createdBy: state.userId,
      });
      form.reset();
      setMessage('تم حفظ قائمة المراقبة.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
}

export function renderAlerts(
  view: HTMLElement,
  state: IntelligenceUiState,
  setMessage: Message,
): void {
  const unread = state.alerts.filter((alert) => !alert.read).length;
  view.innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">ALERTS</p><h2>التنبيهات</h2>
      <p class="muted">${unread} تنبيه غير مقروء</p></div>
      <button class="button secondary compact" id="alerts-read-all" type="button">تعليم الكل كمقروء</button>
    </section>
    <section id="alerts-list" class="alert-list"></section>
  `;
  const list = view.querySelector('#alerts-list');
  state.alerts.forEach((alert) => {
    const card = element('article', `alert-card ${alert.severity} ${alert.read ? 'read' : ''}`);
    const body = element('div');
    body.append(element('span', 'provider-badge', alert.type), element('h3', '', alert.title), element('p', '', alert.message), element('small', '', formatDate(alert.createdAt)));
    const button = element('button', 'button secondary compact', alert.read ? 'غير مقروء' : 'مقروء') as HTMLButtonElement;
    button.addEventListener('click', async () => {
      try {
        await markAlertRead(alert.id, !alert.read);
      } catch (error) {
        setMessage(friendlyError(error), 'error');
      }
    });
    card.append(body, button);
    list?.append(card);
  });
  if (!state.alerts.length) list?.append(element('p', 'empty panel', 'لا توجد تنبيهات.'));
  view.querySelector('#alerts-read-all')?.addEventListener('click', async () => {
    try {
      await markAllAlertsRead(state.alerts);
      setMessage('تم تعليم التنبيهات كمقروءة.', 'success');
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    }
  });
}
