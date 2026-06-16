import { canManageContent } from './lib/permissions';
import { friendlyError } from './lib/errors';
import {
  createArabicIntelligenceReport,
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
  toggleGreyBookmark,
  toggleNewsBookmark,
} from './lib/intelligence-data';
import type {
  ArabicIntelligenceReport,
  GreyIntelligenceItem,
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
  greyIntel: GreyIntelligenceItem[];
  reports: ArabicIntelligenceReport[];
}

type Message = (message: string, type?: 'success' | 'error' | 'info') => void;
type CommandAction = 'fetch-arabic' | 'seed-arabic' | 'executive-report';

function element(tag: string, className = '', text = ''): HTMLElement {
  const item = document.createElement(tag);
  item.className = className;
  item.textContent = text;
  return item;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] || character);
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
    rss: 'خلاصة أخبار · RSS',
    gdelt: 'الرصد العالمي · GDELT',
    hackernews: 'هاكر نيوز',
    github: 'جيت هب',
    newsapi: 'واجهة الأخبار',
    cisa_kev: 'الثغرات المستغلة · CISA',
    custom: 'مخصص',
  };
  return labels[provider] || String(provider || 'مصدر');
}

function sourceTypeLabel(value: unknown): string {
  const labels: Record<string, string> = {
    official_news: 'خبر رسمي',
    official_advisory: 'تنبيه رسمي',
    public_news: 'خبر عام',
    public_blog: 'مدونة عامة',
    public_research: 'بحث منشور',
    rss: 'خلاصة أخبار',
    gdelt_query: 'استعلام رصد عالمي',
    github_advisory: 'تنبيه أمني من جيت هب',
    github_repository: 'مستودع جيت هب',
    manual: 'إضافة يدوية',
    grey_metadata_only: 'بيانات وصفية فقط',
    security_vendor: 'شركة أمن سيبراني',
    government_agency: 'جهة حكومية',
    regional_media: 'إعلام إقليمي',
    international_media: 'إعلام دولي',
  };
  return labels[String(value || '')] || String(value || 'مصدر عام');
}

function alertTypeLabel(value: IntelligenceAlert['type']): string {
  const labels: Record<IntelligenceAlert['type'], string> = {
    'high-score': 'أهمية مرتفعة',
    'watchlist-hit': 'تطابق قائمة مراقبة',
    'repository-match': 'مستودع مهم',
    cve: 'ثغرة أمنية',
    'leak-indicator': 'مؤشر تسريب',
    'fetch-failure': 'تعذر جلب مصدر',
  };
  return labels[value];
}

const INTELLIGENCE_TOPICS = [
  ['إيران', 'إيران'],
  ['الحرس الثوري', 'الحرس الثوري'],
  ['الخليج', 'الخليج'],
  ['السعودية', 'السعودية'],
  ['الملف الشيعي السياسي', 'الملف الشيعي السياسي'],
  ['العراق', 'العراق'],
  ['لبنان', 'لبنان'],
  ['التجسس', 'التجسس والاستخبارات'],
  ['التسريبات', 'التسريبات'],
  ['الأمن السيبراني', 'الأمن السيبراني'],
  ['الذكاء الاصطناعي', 'الذكاء الاصطناعي'],
] as const;

function topicRail(): string {
  return `
    <nav class="topic-rail" aria-label="موضوعات الرصد الرئيسية">
      ${INTELLIGENCE_TOPICS.map(([label, value]) => `<button type="button" data-topic="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join('')}
    </nav>
  `;
}

function bindTopicRail(view: HTMLElement, searchSelector: string, redraw: () => void): void {
  view.querySelectorAll<HTMLButtonElement>('[data-topic]').forEach((button) => {
    button.addEventListener('click', () => {
      const search = view.querySelector<HTMLInputElement>(searchSelector);
      if (!search) return;
      const selected = button.classList.toggle('active');
      view.querySelectorAll<HTMLButtonElement>('[data-topic]').forEach((item) => {
        if (item !== button) item.classList.remove('active');
      });
      search.value = selected ? button.dataset.topic || '' : '';
      redraw();
    });
  });
}

function topicInsights(items: IntelligenceNewsItem[]): string {
  const counts = INTELLIGENCE_TOPICS.map(([label, value]) => [
    label,
    items.filter((item) => `${item.category} ${item.title} ${item.summary_ar || item.summary}`.includes(value)).length,
  ] as const)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);
  return `
    <aside class="intel-insights">
      <div><span>أولوية الرصد</span><strong>${items.filter((item) => item.score >= 75).length}</strong><small>عنصر مرتفع الأهمية</small></div>
      <h3>الموضوعات الأبرز</h3>
      <ol>${counts.map(([label, count]) => `<li><span>${escapeHtml(label)}</span><strong>${count}</strong></li>`).join('') || '<li><span>لا توجد بيانات كافية</span></li>'}</ol>
    </aside>
  `;
}

function scoreClass(score: number): string {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function itemTimestamp(value: unknown): number {
  const timestamp = value as { toMillis?: () => number; toDate?: () => Date };
  if (typeof timestamp?.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate().getTime();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
}

function activeNewsItems(state: IntelligenceUiState): IntelligenceNewsItem[] {
  return state.news
    .filter((item) => item.status !== 'archived')
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
}

function riskRank(value?: string): number {
  if (value === 'حرج') return 4;
  if (value === 'مرتفع') return 3;
  if (value === 'متوسط') return 2;
  return 1;
}

function commandCenterRisk(state: IntelligenceUiState): { score: number; label: 'منخفض' | 'متوسط' | 'مرتفع' | 'حرج' } {
  const news = activeNewsItems(state).slice(0, 40);
  const grey = state.greyIntel.slice(0, 30);
  const criticalAlerts = state.alerts.filter((item) => !item.read && item.severity === 'critical').length;
  const base = [...news.map((item) => Number(item.score || 0)), ...grey.map((item) => riskRank(item.risk_level) * 22)];
  const average = base.length ? base.reduce((total, value) => total + value, 0) / base.length : 18;
  const score = Math.max(0, Math.min(100, Math.round(average + criticalAlerts * 7)));
  return {
    score,
    label: score >= 85 ? 'حرج' : score >= 65 ? 'مرتفع' : score >= 40 ? 'متوسط' : 'منخفض',
  };
}

function todayCount(items: IntelligenceNewsItem[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return items.filter((item) => itemTimestamp(item.publishedAt) >= start.getTime()).length;
}

function commandSection(title: string, items: IntelligenceNewsItem[], empty = 'لا توجد عناصر مطابقة حالياً.'): string {
  return `
    <article class="command-panel">
      <div class="command-panel-heading"><h3>${escapeHtml(title)}</h3><span>${items.length}</span></div>
      <div class="command-list">
        ${items.slice(0, 4).map((item) => `
          <a class="command-list-row" href="#/news" aria-label="${escapeHtml(item.title)}">
            <span class="risk-dot ${scoreClass(item.score)}"></span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.source)} · ${escapeHtml(item.country || item.region || 'إقليمي')} · ${escapeHtml(item.risk_level || 'متوسط')}</small>
          </a>
        `).join('') || `<p class="empty mini-empty">${empty}</p>`}
      </div>
    </article>
  `;
}

function greySummarySection(items: GreyIntelligenceItem[]): string {
  return `
    <article class="command-panel grey-command-panel">
      <div class="command-panel-heading"><h3>المصادر الرمادية والتسريبات — مؤشرات فقط</h3><span>${items.length}</span></div>
      <p class="grey-legal">يتم عرض مؤشرات وملخصات فقط. لا يتم تخزين أو عرض بيانات مسربة خام أو معلومات شخصية حساسة.</p>
      <div class="command-list">
        ${items.slice(0, 4).map((item) => `
          <a class="command-list-row" href="#/grey-intel" aria-label="${escapeHtml(item.title)}">
            <span class="risk-dot ${item.risk_level === 'حرج' ? 'critical' : item.risk_level === 'مرتفع' ? 'high' : 'medium'}"></span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(sourceTypeLabel(item.source_type))} · ${escapeHtml(item.data_sensitivity)} · ${escapeHtml(item.risk_level)}</small>
          </a>
        `).join('') || '<p class="empty mini-empty">لا توجد مؤشرات رمادية حالياً.</p>'}
      </div>
    </article>
  `;
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
  const card = element('article', 'intel-card news-result-card intelligence-row');
  const header = element('div', 'intel-card-header');
  const score = element('span', `score-badge ${scoreClass(item.score)}`, `${item.score}`);
  const identity = element('div', 'intel-card-identity');
  identity.append(
    element('span', 'provider-badge', providerLabel(item.provider)),
    element('span', '', item.source),
    element('span', '', item.category),
    element('span', '', item.country || item.region || 'إقليمي'),
    element('span', 'risk-label', item.risk_level || 'متوسط'),
    element('span', '', item.importance || 'متوسطة'),
  );
  header.append(identity, score);

  const title = element('h3', '', item.title);
  const summary = element('p', 'intel-summary', item.summary_ar || item.summary || item.contentSnippet_ar || item.contentSnippet || 'لا يوجد ملخص متاح.');
  const tags = element('div', 'tag-list');
  stringList(item.tags_ar?.length ? item.tags_ar : item.tags).slice(0, 5).forEach((tag) => tags.append(element('span', '', tag)));

  const details = document.createElement('details');
  details.className = 'intel-details';
  const detailsSummary = document.createElement('summary');
  detailsSummary.textContent = 'التفاصيل والكيانات';
  const entityText = [
    ...stringList(item.entities?.cves),
    ...stringList(item.entities?.domains),
    ...stringList(item.entities?.technologies),
    ...stringList(item.entities?.githubRepos),
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

const legalNotice = 'هذا التقرير يعتمد على مصادر عامة ومؤشرات منشورة. لا يحتوي التقرير على بيانات مسربة خام أو كلمات مرور أو معلومات شخصية حساسة.';

function executiveReportContent(
  news: IntelligenceNewsItem[],
  grey: GreyIntelligenceItem[],
): string {
  const newsLines = news.slice(0, 30).map((item) =>
    `- ${item.title} | ${item.source} | ${item.risk_level || 'متوسط'} | ${item.url}`,
  );
  const greyLines = grey.slice(0, 20).map((item) =>
    `- ${item.title} | ${item.source} | ${item.data_sensitivity} | ${item.risk_level} | ${item.url}`,
  );
  return [
    '# موجز استخباري إقليمي',
    `تاريخ التقرير: ${new Date().toLocaleString('ar-SA')}`,
    'نطاق التغطية: الخليج وإيران والعراق ولبنان واليمن وباكستان والأمن السيبراني.',
    '',
    '## الملخص التنفيذي',
    `جرى تحليل ${news.length} خبر و${grey.length} مؤشر عام. الأولوية للأحداث الحرجة والمرتفعة.`,
    '',
    '## أهم المؤشرات',
    ...newsLines,
    '',
    '## التسريبات والمصادر الرمادية',
    ...(greyLines.length ? greyLines : ['- لا توجد مؤشرات عامة مسجلة حاليًا.']),
    '',
    '## التوصيات التنفيذية',
    '- التحقق من المصادر الأولية قبل اتخاذ قرار.',
    '- متابعة العناصر الحرجة عبر قوائم المراقبة.',
    '- عدم تداول أي بيانات شخصية أو سجلات مسربة خام.',
    '',
    '## تنبيه قانوني',
    legalNotice,
  ].join('\n');
}

async function requestOperation(
  state: IntelligenceUiState,
  setMessage: Message,
  type: 'refresh' | 'seed-arabic' | 'seed-grey',
  scope: 'all' | 'arabic' | 'grey',
  success: string,
): Promise<void> {
  try {
    await requestIntelligenceRefresh(state.userId, '', scope, type);
    setMessage(success, 'success');
  } catch (error) {
    setMessage(friendlyError(error), 'error');
  }
}

export function renderCommandCenter(
  view: HTMLElement,
  state: IntelligenceUiState,
  setMessage: Message,
): void {
  const manager = canManageContent(state.role);
  const news = activeNewsItems(state);
  const risk = commandCenterRisk(state);
  const gulfIran = news.filter((item) =>
    ['الخليج', 'إيران', 'السعودية', 'الحرس الثوري الإيراني', 'الأمن الخليجي'].includes(item.category)
    || `${item.title} ${item.summary_ar || item.summary}`.includes('إيران')
    || `${item.title} ${item.summary_ar || item.summary}`.includes('الخليج'));
  const espionage = news.filter((item) =>
    item.category === 'التجسس والاستخبارات'
    || `${item.title} ${item.summary_ar || item.summary}`.includes('تجسس')
    || `${item.title} ${item.summary_ar || item.summary}`.includes('استخبارات'));
  const strikes = news.filter((item) =>
    ['الضربات والهجمات', 'التصعيد العسكري', 'الصواريخ', 'الطائرات المسيرة'].includes(item.category)
    || ['ضربة', 'هجوم', 'قصف', 'غارة', 'استهداف'].some((term) => `${item.title} ${item.summary_ar || item.summary}`.includes(term)));
  const criticalAlerts = state.alerts.filter((item) => !item.read && item.severity === 'critical').length;
  view.innerHTML = `
    <section class="command-center" data-ui-version="M3TM_UI_VERSION=command-center-v1">
      <section class="command-hero">
        <div>
          <div class="command-brand"><span>M3TM RASED</span><strong>مركز الرصد العربي</strong></div>
          <h2>لوحة الرصد الاستخباري</h2>
          <p>رصد عربي فوري للأخبار والمؤشرات والمخاطر والمستودعات</p>
          <div class="command-actions">
            <button class="button primary" data-command-action="fetch-arabic" ${manager ? '' : 'disabled'}>جلب الأخبار الآن</button>
            <button class="button secondary" data-command-action="seed-arabic" ${manager ? '' : 'disabled'}>تهيئة المصادر</button>
            <button class="button secondary" data-command-action="executive-report">إنشاء تقرير تنفيذي</button>
          </div>
        </div>
        <aside class="risk-meter-card">
          <span>مؤشر الخطر الإقليمي</span>
          <strong>${risk.score}</strong>
          <meter min="0" max="100" value="${risk.score}"></meter>
          <div><small>منخفض</small><small>متوسط</small><small>مرتفع</small><small>حرج</small></div>
          <b class="risk-label">${risk.label}</b>
        </aside>
      </section>

      <section class="command-kpis" aria-label="مؤشرات الرصد">
        <article><span>أخبار اليوم</span><strong>${todayCount(news)}</strong><small>خبر نشط</small></article>
        <article><span>مؤشرات رمادية</span><strong>${state.greyIntel.length}</strong><small>مؤشرات فقط</small></article>
        <article><span>تنبيهات حرجة</span><strong>${criticalAlerts}</strong><small>غير مقروءة</small></article>
        <article><span>مصادر فعالة</span><strong>${state.sources.filter((item) => item.enabled).length}</strong><small>مصدر مراقبة</small></article>
      </section>

      <section class="command-main-grid">
        <article class="command-panel featured-events">
          <div class="command-panel-heading"><h3>الأحداث الأعلى أهمية</h3><a href="#/news">فتح الأخبار العربية</a></div>
          <div class="featured-card-stack"></div>
        </article>
        ${greySummarySection(state.greyIntel)}
        ${commandSection('الخليج وإيران', gulfIran)}
        ${commandSection('التجسس والاستخبارات', espionage)}
        ${commandSection('الضربات والهجمات', strikes)}
        <article class="command-panel">
          <div class="command-panel-heading"><h3>ذكاء المستودعات</h3><a href="#/repositories/intelligence">عرض الكل</a></div>
          <div class="command-list">
            ${state.repositories.slice(0, 4).map((item) => `
              <a class="command-list-row" href="#/repositories/intelligence">
                <span class="risk-dot ${scoreClass(item.score)}"></span>
                <strong>${escapeHtml(item.fullName)}</strong>
                <small>${escapeHtml(item.language || 'غير محدد')} · ★ ${item.stars} · ${escapeHtml(item.implementationPriority)}</small>
              </a>
            `).join('') || '<p class="empty mini-empty">لا توجد مستودعات مرصودة حالياً.</p>'}
          </div>
        </article>
      </section>
    </section>
  `;

  const stack = view.querySelector('.featured-card-stack');
  const selected = new Set<string>();
  news.slice(0, 3).forEach((item) => stack?.append(newsCard(item, state, setMessage, selected)));
  if (!news.length) stack?.append(element('p', 'empty mini-empty', 'لا توجد أخبار نشطة حالياً. شغّل تهيئة المصادر ثم جلب الأخبار.'));

  view.querySelectorAll<HTMLButtonElement>('[data-command-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.commandAction as CommandAction;
      if (action === 'fetch-arabic') {
        await requestOperation(state, setMessage, 'refresh', 'arabic', 'تم تسجيل طلب جلب الأخبار العربية.');
      }
      if (action === 'seed-arabic') {
        await requestOperation(state, setMessage, 'seed-arabic', 'arabic', 'تم تسجيل تهيئة المصادر العربية.');
      }
      if (action === 'executive-report') {
        try {
          await createArabicIntelligenceReport({
            type: 'موجز استخباري إقليمي',
            title: `الموجز التنفيذي - ${new Date().toLocaleDateString('ar-SA')}`,
            coverage: 'الخليج وإيران والعراق ولبنان واليمن وباكستان والأمن السيبراني',
            executiveSummary: `تحليل ${news.length} خبر و${state.greyIntel.length} مؤشر عام.`,
            content: executiveReportContent(news, state.greyIntel),
            newsIds: news.slice(0, 100).map((item) => item.id),
            greyIntelIds: state.greyIntel.slice(0, 100).map((item) => item.id),
            repositoryIds: state.repositories.filter((item) => item.saved).map((item) => item.id),
            riskLevel: risk.label,
            legalNotice,
            createdBy: state.userId,
          });
          setMessage('تم إنشاء مسودة التقرير التنفيذي.', 'success');
        } catch (error) {
          setMessage(friendlyError(error), 'error');
        }
      }
    });
  });
}

export function renderArabicIntelligenceHub(
  view: HTMLElement,
  state: IntelligenceUiState,
  setMessage: Message,
): void {
  renderCommandCenter(view, state, setMessage);
}

export function renderGreyIntelligence(
  view: HTMLElement,
  state: IntelligenceUiState,
  setMessage: Message,
): void {
  view.innerHTML = `
    <section class="page-heading intelligence-heading"><div><h2>المصادر الرمادية والتسريبات</h2>
      <p class="muted">مؤشرات وصفية منشورة من مصادر عامة، مرتبة حسب الخطر والأهمية.</p></div></section>
    ${topicRail()}
    <section class="panel intel-filter-panel glass-toolbar"><div class="intel-filters grey-filters">
      <label>كلمة البحث<input id="grey-search" type="search" /></label>
      <label>الدولة<select id="grey-country"><option value="">الكل</option></select></label>
      <label>مستوى الخطر<select id="grey-risk"><option value="">الكل</option><option>حرج</option><option>مرتفع</option><option>متوسط</option><option>منخفض</option></select></label>
      <label>حساسية البيانات<select id="grey-sensitivity"><option value="">الكل</option><option>عام</option><option>حساس</option><option>مؤشر تسريب</option><option>تسريب محتمل</option><option>محظور التخزين</option></select></label>
    </div></section>
    <div class="intelligence-workspace">
      <section id="grey-results" class="intel-grid intelligence-stream"></section>
      <aside class="intel-insights grey-insights">
        <div><span>مؤشرات مرتفعة</span><strong>${state.greyIntel.filter((item) => ['حرج', 'مرتفع'].includes(item.risk_level)).length}</strong><small>تحتاج تحققاً ومتابعة</small></div>
        <h3>حدود العرض</h3>
        <p>تعرض المنصة بيانات وصفية ومصادر علنية فقط، دون سجلات خام أو بيانات شخصية.</p>
      </aside>
    </div>
  `;
  const country = view.querySelector<HTMLSelectElement>('#grey-country');
  [...new Set(state.greyIntel.map((item) => item.country).filter(Boolean))].sort().forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    country?.append(option);
  });
  const draw = () => {
    const search = view.querySelector<HTMLInputElement>('#grey-search')?.value.toLowerCase() || '';
    const risk = view.querySelector<HTMLSelectElement>('#grey-risk')?.value || '';
    const sensitivity = view.querySelector<HTMLSelectElement>('#grey-sensitivity')?.value || '';
    const items = state.greyIntel.filter((item) =>
      `${item.title} ${item.summary_ar} ${item.source} ${item.tags_ar.join(' ')}`.toLowerCase().includes(search)
      && (!country?.value || item.country === country.value)
      && (!risk || item.risk_level === risk)
      && (!sensitivity || item.data_sensitivity === sensitivity),
    );
    const container = view.querySelector('#grey-results');
    if (!container) return;
    container.textContent = '';
    items.forEach((item) => {
      const card = element('article', 'intel-card grey-card intelligence-row');
      const header = element('div', 'intel-card-header');
      header.append(element('span', 'provider-badge', 'مؤشرات فقط'), element('span', 'risk-label', item.risk_level));
      const meta = element('div', 'tag-list');
      [sourceTypeLabel(item.source_type), item.data_sensitivity, item.leaked_data_type, item.country].filter(Boolean).forEach((value) => meta.append(element('span', '', String(value))));
      if (item.affected_entities.length) {
        meta.append(element('span', '', `الجهات المتأثرة: ${item.affected_entities.slice(0, 4).join('، ')}`));
      }
      const actions = element('div', 'intel-actions');
      const open = element('a', 'button secondary compact', 'فتح المصدر') as HTMLAnchorElement;
      open.href = item.url;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      const save = element('button', 'button secondary compact', 'حفظ') as HTMLButtonElement;
      save.addEventListener('click', async () => {
        try {
          await toggleGreyBookmark(item.id, state.userId, true);
          setMessage('تم حفظ المؤشر.', 'success');
        } catch (error) {
          setMessage(friendlyError(error), 'error');
        }
      });
      const task = element('button', 'button secondary compact', 'إنشاء مهمة متابعة') as HTMLButtonElement;
      task.addEventListener('click', () => void createTaskFromItem({
        title: `متابعة مؤشر: ${item.title}`,
        description: `${item.summary_ar}\n\n${item.legal_warning}`,
        sourceType: 'news',
        sourceIds: [item.id],
        createdBy: state.userId,
      }).then(() => setMessage('تم إنشاء مهمة المتابعة.', 'success')).catch((error) => setMessage(friendlyError(error), 'error')));
      const report = element('button', 'button primary compact', 'إنشاء تقرير') as HTMLButtonElement;
      report.addEventListener('click', async () => {
        try {
          await createArabicIntelligenceReport({
            type: 'تقرير التسريبات والمصادر الرمادية',
            title: `تقرير مؤشر: ${item.title}`,
            coverage: `${item.country || item.region} · ${formatDate(item.publishedAt)}`,
            executiveSummary: item.summary_ar,
            content: executiveReportContent([], [item]),
            newsIds: [],
            greyIntelIds: [item.id],
            repositoryIds: [],
            riskLevel: item.risk_level,
            legalNotice,
            createdBy: state.userId,
          });
          setMessage('تم إنشاء تقرير المؤشر.', 'success');
        } catch (error) {
          setMessage(friendlyError(error), 'error');
        }
      });
      actions.append(open, save, task, report);
      card.append(header, element('h3', '', item.title), element('p', 'intel-summary', item.summary_ar), meta, actions);
      container.append(card);
    });
    if (!items.length) container.append(element('p', 'empty panel', 'لا توجد مؤشرات مطابقة. هيّئ المصادر الرمادية ثم اطلب الجلب.'));
  };
  view.querySelectorAll('#grey-search, #grey-country, #grey-risk, #grey-sensitivity').forEach((control) => control.addEventListener('input', draw));
  bindTopicRail(view, '#grey-search', draw);
  draw();
}

export function renderIntelligenceReports(view: HTMLElement, state: IntelligenceUiState): void {
  view.innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">تقارير عربية محكومة بالمصادر</p><h2>التقارير التنفيذية</h2>
      <p class="muted">${legalNotice}</p></div></section>
    <section class="report-list"></section>
  `;
  const list = view.querySelector('.report-list');
  state.reports.forEach((report) => {
    const card = element('article', 'panel report-card');
    card.append(element('span', 'provider-badge', report.type), element('h3', '', report.title), element('p', 'muted', report.executiveSummary), element('small', '', `${report.riskLevel} · ${formatDate(report.createdAt)}`));
    const details = document.createElement('details');
    details.append(element('summary', '', 'عرض التقرير'), element('pre', 'report-content', report.content));
    card.append(details);
    list?.append(card);
  });
  if (!state.reports.length) list?.append(element('p', 'empty panel', 'لم تُنشأ تقارير تنفيذية بعد.'));
}

export function renderNewsIntelligence(
  view: HTMLElement,
  state: IntelligenceUiState,
  setMessage: Message,
): void {
  view.innerHTML = `
    <section class="page-heading intelligence-heading">
      <div><h2>مركز أخبار M3TM</h2>
      <p class="muted">موجز تحليلي يركز على المنطقة والأمن السيبراني والذكاء الاصطناعي.</p></div>
      ${canManageContent(state.role) ? '<button class="button primary compact" id="intelligence-refresh" type="button">طلب تحديث شامل</button>' : ''}
    </section>
    ${topicRail()}
    <section class="intel-metrics">
      <article><span>العناصر</span><strong>${state.news.length}</strong></article>
      <article><span>عالية الأهمية</span><strong>${state.news.filter((item) => item.score >= 75).length}</strong></article>
      <article><span>المحفوظة</span><strong>${state.bookmarks.size}</strong></article>
      <article><span>المصادر النشطة</span><strong>${state.sources.filter((item) => item.enabled).length}</strong></article>
    </section>
    <section class="panel intel-filter-panel glass-toolbar">
      <div class="intel-filters">
        <label class="intel-search-field">بحث<input id="intel-search" type="search" placeholder="ابحث في العنوان أو المصدر أو الوسوم..." /></label>
        <label>التصنيف<select id="intel-category"><option value="">الكل</option></select></label>
        <label>الدولة<select id="intel-country"><option value="">الكل</option></select></label>
        <label>المزود<select id="intel-provider"><option value="">الكل</option></select></label>
        <label>مستوى الخطر<select id="intel-risk"><option value="">الكل</option><option>حرج</option><option>مرتفع</option><option>متوسط</option><option>منخفض</option></select></label>
        <label>الترتيب<select id="intel-sort"><option value="relevance">الأكثر صلة</option><option value="recent">الأحدث</option><option value="risk">الأعلى خطراً</option></select></label>
        <label class="toggle"><input id="intel-bookmarked" type="checkbox" /><span>المحفوظة فقط</span></label>
      </div>
      <div class="card-actions"><button class="button secondary compact" id="bulk-report" type="button">تقرير من المحدد</button>
      <span id="intel-result-count" class="muted"></span></div>
    </section>
    <div class="intelligence-workspace">
      <section id="intelligence-results" class="intel-grid news-results intelligence-stream"></section>
      ${topicInsights(state.news.filter((item) => item.status !== 'archived'))}
    </div>
    <nav id="intel-pagination" class="intel-pagination" aria-label="صفحات النتائج"></nav>
  `;

  renderSourceAdmin(view, state, setMessage);
  const selected = new Set<string>();
  const pageSize = 12;
  let currentPage = 1;
  const category = view.querySelector<HTMLSelectElement>('#intel-category');
  const country = view.querySelector<HTMLSelectElement>('#intel-country');
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
  [...new Set(state.news.map((item) => item.country).filter(Boolean))].sort().forEach((value) => {
    const option = document.createElement('option');
    option.value = value || '';
    option.textContent = value || '';
    country?.append(option);
  });

  const draw = (resetPage = false) => {
    if (resetPage) currentPage = 1;
    const container = view.querySelector('#intelligence-results');
    if (!container) return;
    const search = view.querySelector<HTMLInputElement>('#intel-search')?.value.trim().toLowerCase() || '';
    const selectedCategory = category?.value || '';
    const selectedProvider = provider?.value || '';
    const selectedRisk = view.querySelector<HTMLSelectElement>('#intel-risk')?.value || '';
    const selectedSort = view.querySelector<HTMLSelectElement>('#intel-sort')?.value || 'relevance';
    const bookmarksOnly = view.querySelector<HTMLInputElement>('#intel-bookmarked')?.checked || false;
    const items = state.news.filter((item) => {
      const haystack = `${item.title} ${item.summary_ar || item.summary || ''} ${item.contentSnippet_ar || item.contentSnippet || ''} ${item.source} ${stringList(item.tags_ar?.length ? item.tags_ar : item.tags).join(' ')}`.toLowerCase();
      return (!search || haystack.includes(search))
        && item.status !== 'archived'
        && (!selectedCategory || item.category === selectedCategory)
        && (!selectedProvider || item.provider === selectedProvider)
        && (!country?.value || item.country === country.value)
        && (!selectedRisk || item.risk_level === selectedRisk)
        && (!bookmarksOnly || state.bookmarks.has(item.id));
    });
    items.sort((left, right) => {
      if (selectedSort === 'recent') return itemTimestamp(right.publishedAt) - itemTimestamp(left.publishedAt);
      if (selectedSort === 'risk') return Number(right.score || 0) - Number(left.score || 0);
      const relevance = Number(right.relevance_score ?? right.score ?? 0) - Number(left.relevance_score ?? left.score ?? 0);
      return relevance || itemTimestamp(right.publishedAt) - itemTimestamp(left.publishedAt);
    });
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * pageSize;
    const visibleItems = items.slice(start, start + pageSize);
    container.textContent = '';
    visibleItems.forEach((item) => container.append(newsCard(item, state, setMessage, selected)));
    if (!items.length) container.append(element('p', 'empty panel', 'لا توجد نتائج مطابقة للفلاتر الحالية.'));
    const count = view.querySelector('#intel-result-count');
    if (count) count.textContent = items.length
      ? `عرض ${start + 1}–${Math.min(start + pageSize, items.length)} من ${items.length}`
      : 'لا توجد نتائج';
    const pagination = view.querySelector<HTMLElement>('#intel-pagination');
    if (pagination) {
      pagination.textContent = '';
      if (pageCount > 1) {
        const previous = element('button', 'button secondary compact', 'السابق') as HTMLButtonElement;
        previous.type = 'button';
        previous.disabled = currentPage === 1;
        previous.addEventListener('click', () => {
          currentPage -= 1;
          draw();
          view.querySelector('#intelligence-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        const indicator = element('span', 'muted', `صفحة ${currentPage} من ${pageCount}`);
        const next = element('button', 'button secondary compact', 'التالي') as HTMLButtonElement;
        next.type = 'button';
        next.disabled = currentPage === pageCount;
        next.addEventListener('click', () => {
          currentPage += 1;
          draw();
          view.querySelector('#intelligence-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        pagination.append(previous, indicator, next);
      }
    }
  };
  view.querySelectorAll('#intel-search, #intel-category, #intel-country, #intel-provider, #intel-risk, #intel-sort, #intel-bookmarked')
    .forEach((control) => control.addEventListener('input', () => draw(true)));
  bindTopicRail(view, '#intel-search', () => draw(true));
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
    <section class="page-heading"><div><p class="eyebrow">مراقبة المستودعات العامة</p>
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
    <section class="page-heading"><div><p class="eyebrow">رصد الكيانات والموضوعات</p><h2>قوائم المراقبة</h2>
      <p class="muted">راقب الكلمات والكيانات والثغرات والمستودعات تلقائيًا.</p></div></section>
    <section class="panel">
      <form id="watchlist-form" class="form-grid">
        <input name="id" type="hidden" />
        <label>الاسم<input name="name" required maxlength="160" /></label>
        <label>النوع<select name="type"><option value="mixed">أخبار ومستودعات</option><option value="دولة">دولة</option><option value="شركة">شركة</option><option value="جهة حكومية">جهة حكومية</option><option value="شخص">شخص</option><option value="دومين">دومين</option><option value="بريد">بريد</option><option value="CVE">CVE</option><option value="جماعة/فصيل">جماعة/فصيل</option><option value="كلمة مفتاحية">كلمة مفتاحية</option><option value="مستودع GitHub">مستودع GitHub</option><option value="مصدر إخباري">مصدر إخباري</option></select></label>
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
    <section class="page-heading"><div><p class="eyebrow">تنبيهات المخاطر والتطابقات</p><h2>التنبيهات</h2>
      <p class="muted">${unread} تنبيه غير مقروء</p></div>
      <button class="button secondary compact" id="alerts-read-all" type="button">تعليم الكل كمقروء</button>
    </section>
    <section id="alerts-list" class="alert-list"></section>
  `;
  const list = view.querySelector('#alerts-list');
  state.alerts.forEach((alert) => {
    const card = element('article', `alert-card ${alert.severity} ${alert.read ? 'read' : ''}`);
    const body = element('div');
    body.append(element('span', 'provider-badge', alertTypeLabel(alert.type)), element('h3', '', alert.title), element('p', '', alert.message), element('small', '', formatDate(alert.createdAt)));
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
