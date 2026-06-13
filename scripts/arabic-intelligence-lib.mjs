import { intelligenceHash } from './intelligence-lib.mjs';

export const LEGAL_NOTICE =
  'هذا التقرير يعتمد على مصادر عامة ومؤشرات منشورة. لا يحتوي التقرير على بيانات مسربة خام أو كلمات مرور أو معلومات شخصية حساسة.';

export const ARABIC_CATEGORIES = [
  'الخليج', 'السعودية', 'الإمارات', 'قطر', 'الكويت', 'البحرين', 'عمان', 'اليمن',
  'إيران', 'العراق', 'لبنان', 'باكستان', 'سوريا', 'الأردن', 'مصر', 'تركيا',
  'إسرائيل وفلسطين', 'البحر الأحمر', 'مضيق هرمز', 'باب المندب', 'الطاقة والنفط',
  'الممرات البحرية', 'العقوبات الدولية', 'الضربات والهجمات', 'التصعيد العسكري',
  'التجسس والاستخبارات', 'الأمن السيبراني', 'التسريبات', 'تسريبات البيانات',
  'المصادر الرمادية', 'اختراقات وتسريبات', 'الملف الشيعي السياسي', 'حزب الله',
  'الحوثيون', 'الحرس الثوري الإيراني', 'الحشد الشعبي', 'الفصائل المسلحة',
  'الحملات الإعلامية والتضليل', 'الذكاء الاصطناعي', 'التقنية والتحول الرقمي',
  'الأمن الخليجي', 'الأمن البحري', 'الطائرات المسيرة', 'الصواريخ', 'الاغتيالات',
  'الاحتجاجات والاضطرابات', 'الانتخابات والسياسة', 'الاقتصاد والأسواق',
  'العملات والطاقة', 'الكوارث والأزمات',
];

export const ARABIC_KEYWORD_GROUPS = {
  الخليج: ['الخليج', 'دول الخليج', 'مجلس التعاون الخليجي', 'الخليج العربي', 'أمن الخليج', 'السعودية', 'الإمارات', 'قطر', 'الكويت', 'البحرين', 'عمان', 'اليمن', 'المنطقة الشرقية', 'الرياض', 'أبوظبي', 'دبي', 'الدوحة', 'المنامة', 'مسقط'],
  إيران: ['إيران', 'طهران', 'خامنئي', 'بزشكيان', 'رئيسي', 'الحرس الثوري', 'فيلق القدس', 'البرنامج النووي الإيراني', 'العقوبات على إيران', 'صواريخ إيران', 'نفوذ إيران', 'الميليشيات المدعومة من إيران'],
  'الضربات والهجمات': ['ضربة', 'ضربات', 'هجوم', 'هجمات', 'قصف', 'استهداف', 'غارة', 'غارات', 'صاروخ', 'صواريخ', 'مسيرة', 'مسيرات', 'انفجار', 'اشتباك', 'عملية عسكرية', 'تصعيد عسكري', 'اغتيال', 'تفجير', 'هجوم سيبراني'],
  'التجسس والاستخبارات': ['تجسس', 'جاسوس', 'جواسيس', 'استخبارات', 'مخابرات', 'الموساد', 'CIA', 'MI6', 'اختراق', 'تسريب', 'مراقبة', 'تنصت', 'شبكة تجسس', 'عمليات استخباراتية', 'عميل', 'عملاء', 'معلومات سرية'],
  التسريبات: ['تسريب', 'تسريبات', 'بيانات مسربة', 'وثائق مسربة', 'بريد مسرب', 'قاعدة بيانات', 'اختراق', 'خرق بيانات', 'تسرب بيانات', 'فضيحة', 'وثائق سرية', 'ملفات مسربة', 'حسابات مسربة', 'بيانات العملاء', 'بيانات حكومية', 'تسريب أمني', 'تسريب استخباراتي', 'leak', 'leaks', 'leaked database', 'data breach', 'breach', 'exposed database', 'credentials leak', 'dump', 'data exposure', 'ransomware leak', 'stolen data', 'classified documents', 'intelligence leak', 'government leak', 'company breach'],
  'الملف الشيعي السياسي': ['الشيعة', 'شيعي', 'الأحزاب الشيعية', 'المرجعية', 'النجف', 'قم', 'الحشد الشعبي', 'حزب الله', 'الحوثيون', 'الفصائل الشيعية', 'الميليشيات المدعومة من إيران', 'النفوذ الإيراني', 'التيار الصدري', 'الإطار التنسيقي'],
  لبنان: ['لبنان', 'بيروت', 'حزب الله', 'الجنوب اللبناني', 'الحدود اللبنانية', 'إسرائيل ولبنان', 'نبيه بري', 'حسن نصر الله', 'الجيش اللبناني', 'الضاحية الجنوبية'],
  العراق: ['العراق', 'بغداد', 'البصرة', 'النجف', 'كربلاء', 'الحشد الشعبي', 'الفصائل العراقية', 'المقاومة الإسلامية في العراق', 'الحكومة العراقية', 'كردستان العراق', 'أربيل'],
  باكستان: ['باكستان', 'إسلام آباد', 'الجيش الباكستاني', 'الاستخبارات الباكستانية', 'الهند وباكستان', 'الحدود الباكستانية', 'بلوشستان', 'كشمير', 'طالبان باكستان'],
  الحوثيون: ['الحوثي', 'الحوثيون', 'أنصار الله', 'اليمن', 'صنعاء', 'البحر الأحمر', 'باب المندب', 'السفن', 'الملاحة', 'الصواريخ الحوثية', 'المسيرات الحوثية', 'استهداف السفن'],
  'حزب الله': ['حزب الله', 'لبنان', 'الجنوب اللبناني', 'حسن نصر الله', 'المقاومة الإسلامية في لبنان', 'الضاحية الجنوبية', 'الحدود اللبنانية الإسرائيلية'],
  'الحرس الثوري الإيراني': ['الحرس الثوري', 'فيلق القدس', 'قادة الحرس الثوري', 'صواريخ إيرانية', 'طائرات مسيرة إيرانية', 'عمليات الحرس الثوري', 'قاآني'],
  'الممرات البحرية': ['مضيق هرمز', 'باب المندب', 'البحر الأحمر', 'خليج عمان', 'الملاحة البحرية', 'ناقلات النفط', 'السفن التجارية', 'استهداف السفن', 'أمن الممرات البحرية', 'التحالف البحري'],
  'الذكاء الاصطناعي': ['الذكاء الاصطناعي', 'نماذج اللغة', 'وكلاء الذكاء الاصطناعي', 'LLM', 'AI agents', 'OpenAI', 'Gemini', 'Claude', 'DeepSeek', 'Qwen', 'نماذج مفتوحة', 'أتمتة'],
  'الأمن السيبراني': ['أمن سيبراني', 'اختراق', 'ثغرة', 'CVE', 'برمجيات خبيثة', 'فدية', 'ransomware', 'malware', 'phishing', 'تسريب بيانات', 'هجوم سيبراني', 'اختراق حكومي'],
};

const COUNTRIES = ['السعودية', 'الإمارات', 'قطر', 'الكويت', 'البحرين', 'عمان', 'اليمن', 'إيران', 'العراق', 'لبنان', 'باكستان', 'سوريا', 'الأردن', 'مصر', 'تركيا', 'إسرائيل', 'فلسطين', 'أمريكا', 'بريطانيا', 'الصين', 'روسيا'];
const ORGANIZATIONS = ['الحرس الثوري', 'فيلق القدس', 'حزب الله', 'الحوثيون', 'الحشد الشعبي', 'الموساد', 'CIA', 'MI6', 'الجيش الباكستاني', 'الجيش اللبناني', 'أرامكو', 'أوبك', 'مجلس التعاون الخليجي'];
const PLACES = ['مضيق هرمز', 'باب المندب', 'البحر الأحمر', 'الخليج', 'بيروت', 'بغداد', 'طهران', 'صنعاء', 'إسلام آباد', 'الرياض', 'أبوظبي', 'دبي', 'الدوحة', 'الكويت', 'المنامة', 'مسقط'];
const SECURITY_TERMS = ['تجسس', 'قصف', 'هجوم', 'ضربة', 'غارة', 'صاروخ', 'مسيرة', 'اختراق', 'تسريب', 'عقوبات', 'اغتيال', 'انفجار', 'خرق بيانات', 'فدية', 'CVE'];

function clean(value, max = 10_000) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function findTerms(text, terms) {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

export function classifyArabicCategory(input, fallback = 'الخليج') {
  const text = clean(input).toLowerCase();
  let best = fallback;
  let bestScore = 0;
  for (const [category, keywords] of Object.entries(ARABIC_KEYWORD_GROUPS)) {
    const score = keywords.reduce((total, keyword) => total + (text.includes(keyword.toLowerCase()) ? Math.max(1, keyword.split(' ').length) : 0), 0);
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}

export function extractArabicEntities(input) {
  const text = clean(input, 50_000);
  return {
    countries: findTerms(text, COUNTRIES),
    organizations: findTerms(text, ORGANIZATIONS),
    places: findTerms(text, PLACES),
    securityTerms: findTerms(text, SECURITY_TERMS),
  };
}

export function inferCountryRegion(input) {
  const entities = extractArabicEntities(input);
  const country = entities.countries[0] || '';
  const gulfCountries = new Set(['السعودية', 'الإمارات', 'قطر', 'الكويت', 'البحرين', 'عمان', 'اليمن']);
  const region = gulfCountries.has(country)
    ? 'الخليج'
    : ['إيران', 'العراق', 'لبنان', 'سوريا', 'الأردن', 'إسرائيل', 'فلسطين'].includes(country)
      ? 'الشرق الأوسط'
      : country === 'باكستان' ? 'جنوب آسيا' : 'إقليمي';
  return { country, region };
}

export function scoreArabicRisk(item, options = {}) {
  const text = clean(`${item.title} ${item.summary_ar || item.summary} ${item.contentSnippet_ar || item.contentSnippet}`).toLowerCase();
  const critical = ['اغتيال', 'ضربة مباشرة', 'قصف', 'غارة', 'استهداف سفن', 'تسريب استخباراتي', 'وثائق سرية', 'actively exploited', 'ransomware leak'];
  const high = ['تجسس', 'شبكة تجسس', 'عقوبات', 'حركة ميليشيا', 'خرق بيانات', 'تهديد الملاحة', 'هجوم سيبراني', 'صاروخ', 'مسيرة'];
  const medium = ['تصعيد', 'تحذير', 'مناورة عسكرية', 'ثغرة', 'security advisory', 'احتجاجات'];
  let score = Math.max(0, Math.min(100, Number(options.baseScore ?? item.score ?? 25)));
  score += critical.filter((term) => text.includes(term)).length * 18;
  score += high.filter((term) => text.includes(term)).length * 10;
  score += medium.filter((term) => text.includes(term)).length * 5;
  if ((text.includes('الخليج') || text.includes('السعودية')) && text.includes('إيران')) score += 15;
  if (text.includes('مضيق هرمز') || text.includes('باب المندب') || text.includes('البحر الأحمر')) score += 10;
  score = Math.min(100, Math.round(score));
  return {
    score,
    risk_level: score >= 85 ? 'حرج' : score >= 65 ? 'مرتفع' : score >= 40 ? 'متوسط' : 'منخفض',
    importance: score >= 85 ? 'عاجلة' : score >= 65 ? 'عالية' : score >= 40 ? 'متوسطة' : 'منخفضة',
    confidence: Math.min(95, Math.max(45, Number(options.reliability ?? 70))),
  };
}

export function toArabicIntelligenceItem(item, source = {}) {
  const summary = clean(item.summary_ar || item.summary || item.contentSnippet, 4000);
  const content = clean(`${item.title} ${summary}`);
  const category = source.category || classifyArabicCategory(content);
  const location = inferCountryRegion(content);
  const risk = scoreArabicRisk(item, { reliability: source.reliability_score || source.priority });
  const arabicEntities = extractArabicEntities(content);
  return {
    ...item,
    source_type: source.source_type || 'public_news',
    language: source.language || item.language || 'ar',
    country: location.country,
    region: location.region,
    category,
    subcategory: category,
    summary_ar: summary,
    contentSnippet_ar: clean(item.contentSnippet || summary, 2000),
    tags_ar: [...new Set([category, ...arabicEntities.countries, ...arabicEntities.organizations, ...arabicEntities.securityTerms])].slice(0, 30),
    importance: risk.importance,
    risk_level: risk.risk_level,
    confidence: risk.confidence,
    sentiment: risk.risk_level === 'حرج' || risk.risk_level === 'مرتفع' ? 'سلبي' : 'محايد',
    score: risk.score,
    entities: {
      ...item.entities,
      countries: [...new Set([...(item.entities?.countries || []), ...arabicEntities.countries])],
      organizations: [...new Set([...(item.entities?.organizations || []), ...arabicEntities.organizations])],
    },
  };
}

export function toGreyMetadataItem(item, source = {}) {
  const arabic = toArabicIntelligenceItem(item, {
    ...source,
    source_type: source.source_type || 'grey_metadata_only',
    category: source.category || 'المصادر الرمادية',
  });
  const text = `${arabic.title} ${arabic.summary_ar}`.toLowerCase();
  const forbidden = source.data_sensitivity === 'محظور التخزين';
  const leakedDataType = text.includes('credential') || text.includes('كلمات مرور')
    ? 'بيانات اعتماد - مؤشر فقط'
    : text.includes('government') || text.includes('حكوم')
      ? 'بيانات حكومية - مؤشر فقط'
      : text.includes('ransomware') || text.includes('فدية')
        ? 'ادعاء تسريب فدية'
        : 'مؤشر تسريب عام';
  return {
    id: arabic.id || intelligenceHash([arabic.url, arabic.title]),
    title: arabic.title,
    url: arabic.url,
    source: arabic.source,
    provider: arabic.provider,
    source_type: source.source_type || 'grey_metadata_only',
    language: arabic.language,
    country: arabic.country,
    region: arabic.region,
    category: source.category || 'المصادر الرمادية',
    subcategory: text.includes('cve') || text.includes('ثغرة') ? 'الأمن السيبراني' : 'اختراقات وتسريبات',
    summary_ar: arabic.summary_ar,
    contentSnippet_ar: forbidden ? '' : arabic.contentSnippet_ar.slice(0, 700),
    affected_entities: [...new Set([...arabic.entities.organizations, ...arabic.entities.domains])].slice(0, 30),
    leaked_data_type: leakedDataType,
    data_sensitivity: source.data_sensitivity || (text.includes('leak') || text.includes('تسريب') ? 'مؤشر تسريب' : 'حساس'),
    risk_level: arabic.risk_level,
    importance: arabic.importance,
    confidence: arabic.confidence,
    tags_ar: [...new Set(['مؤشرات فقط', ...arabic.tags_ar])].slice(0, 30),
    entities: arabic.entities,
    publishedAt: arabic.publishedAt,
    fetchedAt: arabic.fetchedAt,
    hash: arabic.hash,
    rawPayloadMetadataOnly: {
      providerReference: item.rawPayload?.id || item.rawPayload?.cve || '',
      sourceType: source.source_type || 'grey_metadata_only',
    },
    legal_warning: LEGAL_NOTICE,
    status: arabic.status || 'active',
  };
}

export function buildArabicExecutiveReport({ type, title, items = [], greyItems = [], repositories = [], coverage = 'آخر 7 أيام' }) {
  const allRisk = [...items, ...greyItems].map((item) => item.risk_level);
  const riskLevel = allRisk.includes('حرج') ? 'حرج' : allRisk.includes('مرتفع') ? 'مرتفع' : allRisk.includes('متوسط') ? 'متوسط' : 'منخفض';
  const section = (heading, values) => `## ${heading}\n\n${values.length ? values.map((item) => `- ${item.title} (${item.source || item.fullName || 'مصدر عام'})`).join('\n') : '- لا توجد مؤشرات بارزة.'}`;
  const urgent = items.filter((item) => item.importance === 'عاجلة' || item.risk_level === 'حرج');
  const gulfIran = items.filter((item) => ['الخليج', 'إيران', 'السعودية', 'الأمن الخليجي'].includes(item.category));
  const regional = items.filter((item) => ['لبنان', 'العراق', 'باكستان'].includes(item.category));
  const espionage = items.filter((item) => item.category === 'التجسس والاستخبارات');
  const strikes = items.filter((item) => ['الضربات والهجمات', 'التصعيد العسكري'].includes(item.category));
  const cyber = items.filter((item) => item.category === 'الأمن السيبراني');
  const content = [
    `# ${title}`,
    `تاريخ التقرير: ${new Date().toISOString().slice(0, 10)}`,
    `نطاق التغطية: ${coverage}`,
    `مستوى المخاطر العام: ${riskLevel}`,
    '## الملخص التنفيذي\n\nيعرض هذا التقرير المؤشرات الأبرز من المصادر العامة مع فصل واضح بين الأخبار المؤكدة والمؤشرات التي تحتاج تحققًا إضافيًا.',
    section('أهم المؤشرات', [...urgent, ...items].slice(0, 10)),
    section('الأحداث العاجلة', urgent),
    section('الخليج وإيران', gulfIran),
    section('لبنان والعراق وباكستان', regional),
    section('التجسس والاستخبارات', espionage),
    section('الضربات والهجمات', strikes),
    section('التسريبات والمصادر الرمادية', greyItems),
    section('الأمن السيبراني', cyber),
    section('المستودعات والأدوات المهمة', repositories),
    '## التوصيات التنفيذية\n\n- التحقق المتقاطع من المؤشرات عالية الخطورة قبل اتخاذ قرار.\n- متابعة المصادر الرسمية عند تطور الأحداث.\n- عدم تداول أي بيانات شخصية أو مواد مسربة خام.',
    `## تنبيه قانوني\n\n${LEGAL_NOTICE}`,
  ].join('\n\n');
  return {
    type,
    title,
    coverage,
    riskLevel,
    executiveSummary: `تحليل ${items.length} خبر و${greyItems.length} مؤشر عام مع أولوية للعناصر الأعلى خطرًا.`,
    content,
    legalNotice: LEGAL_NOTICE,
  };
}
