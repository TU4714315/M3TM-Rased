import { intelligenceHash } from './intelligence-lib.mjs';

const GDELT_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

export const ARABIC_GDELT_QUERIES = [
  ['الخليج وإيران', '(الخليج OR السعودية OR الإمارات OR الكويت OR قطر OR البحرين OR عمان) AND (إيران OR الحرس الثوري OR فيلق القدس)', 'الخليج'],
  ['الضربات والهجمات', '(ضربة OR قصف OR هجوم OR غارة OR استهداف OR صاروخ OR مسيرة) AND (إيران OR العراق OR لبنان OR اليمن OR الخليج OR باكستان)', 'الضربات والهجمات'],
  ['التجسس والاستخبارات', '(تجسس OR استخبارات OR مخابرات OR جاسوس OR الموساد OR CIA OR اختراق OR تسريب) AND (الخليج OR إيران OR لبنان OR العراق OR باكستان)', 'التجسس والاستخبارات'],
  ['الملف الشيعي السياسي', '(الشيعة OR الحشد الشعبي OR حزب الله OR الحوثيون OR الفصائل الشيعية OR المرجعية OR النجف OR قم) AND (إيران OR العراق OR لبنان OR اليمن OR الخليج)', 'الملف الشيعي السياسي'],
  ['الممرات البحرية', '(مضيق هرمز OR باب المندب OR البحر الأحمر OR ناقلات النفط OR الملاحة البحرية OR استهداف السفن)', 'الممرات البحرية'],
  ['الأمن السيبراني والتسريبات', '(اختراق OR تسريب بيانات OR خرق بيانات OR ransomware OR CVE OR malware OR leak OR breach) AND (السعودية OR الخليج OR إيران OR العراق OR لبنان OR باكستان)', 'الأمن السيبراني'],
  ['الذكاء الاصطناعي', '(الذكاء الاصطناعي OR نماذج اللغة OR AI agents OR LLM OR OpenAI OR DeepSeek OR Gemini)', 'الذكاء الاصطناعي'],
  ['الطاقة والنفط', '(النفط OR الطاقة OR أوبك OR أرامكو OR ناقلات النفط OR أسواق الطاقة) AND (الخليج OR إيران OR البحر الأحمر OR مضيق هرمز)', 'الطاقة والنفط'],
  ['الاحتجاجات والاضطرابات', '(احتجاجات OR اضطرابات OR مظاهرات OR اشتباكات OR أزمة سياسية) AND (إيران OR العراق OR لبنان OR باكستان)', 'الاحتجاجات والاضطرابات'],
  ['العقوبات', '(عقوبات OR عقوبات أمريكية OR عقوبات أوروبية OR مجلس الأمن) AND (إيران OR حزب الله OR الحوثيين OR الحرس الثوري)', 'العقوبات الدولية'],
];

export const ARABIC_MEDIA_SOURCES = [
  ['الجزيرة نت', 'aljazeera.net', 'regional_media', 86],
  ['العربية', 'alarabiya.net', 'regional_media', 86],
  ['الشرق الأوسط', 'aawsat.com', 'regional_media', 84],
  ['الشرق للأخبار', 'asharq.com', 'regional_media', 84],
  ['سكاي نيوز عربية', 'skynewsarabia.com', 'regional_media', 82],
  ['BBC عربي', 'bbc.com/arabic', 'international_media', 88],
  ['CNN Arabic', 'arabic.cnn.com', 'international_media', 82],
  ['France 24 Arabic', 'france24.com/ar', 'international_media', 84],
  ['DW عربية', 'dw.com/ar', 'international_media', 82],
  ['الحرة', 'alhurra.com', 'international_media', 80],
  ['RT Arabic', 'arabic.rt.com', 'international_media', 68],
  ['CNBC عربية', 'cnbcarabia.com', 'regional_media', 80],
  ['وكالة الأنباء السعودية واس', 'spa.gov.sa', 'government_agency', 95],
  ['وكالة أنباء الإمارات وام', 'wam.ae/ar', 'government_agency', 95],
  ['وكالة الأنباء الكويتية كونا', 'kuna.net.kw', 'government_agency', 95],
  ['وكالة الأنباء القطرية قنا', 'qna.org.qa', 'government_agency', 95],
  ['وكالة أنباء البحرين بنا', 'bna.bh', 'government_agency', 95],
  ['وكالة الأنباء العمانية', 'omannews.gov.om', 'government_agency', 95],
  ['وكالة الأنباء العراقية واع', 'ina.iq', 'government_agency', 92],
  ['الوكالة الوطنية للإعلام اللبنانية', 'nna-leb.gov.lb', 'government_agency', 92],
  ['وكالة إرنا الإيرانية', 'irna.ir', 'government_agency', 82],
  ['وكالة الأنباء الباكستانية', 'app.com.pk', 'government_agency', 88],
  ['الخليج أونلاين', 'alkhaleejonline.net', 'regional_media', 72],
  ['إندبندنت عربية', 'independentarabia.com', 'regional_media', 80],
  ['العربي الجديد', 'alaraby.co.uk', 'regional_media', 76],
  ['الميادين - رصد مصدر مقابل', 'almayadeen.net', 'regional_media', 58],
  ['المنار - رصد علني مقابل', 'almanar.com.lb', 'regional_media', 50],
  ['سبأ - مصدر يمني علني', 'saba.ye', 'government_agency', 58],
];

export const ARABIC_RSS_SOURCES = [
  ['BBC عربي', 'https://feeds.bbci.co.uk/arabic/rss.xml', 'international_media', 88],
  ['الجزيرة نت', 'https://www.aljazeera.net/aljazeerarss/3a66a9cb-a4d5-426c-836d-2d1d436a5854/4e9f594a-336a-4fb7-bde4-6d67c56e64b1', 'regional_media', 86],
  ['سكاي نيوز عربية', 'https://www.skynewsarabia.com/web/rss', 'regional_media', 82],
  ['العربي الجديد', 'https://www.alaraby.co.uk/rss', 'regional_media', 76],
];

export const GREY_SECURITY_SOURCES = [
  {
    id: 'cisa-kev',
    name: 'CISA Known Exploited Vulnerabilities',
    provider: 'cisa_kev',
    type: 'cisa_kev',
    url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    source_type: 'government_agency',
    category: 'الأمن السيبراني',
    language: 'en',
    priority: 98,
    reliability_score: 98,
    data_sensitivity: 'عام',
    enabled: true,
  },
  ['Microsoft Security Response Center', 'https://msrc.microsoft.com/blog/feed', 'security_vendor', 94],
  ['Google Security Blog', 'https://security.googleblog.com/feeds/posts/default', 'public_blog', 94],
  ['Mandiant Public Reports', 'https://cloud.google.com/blog/topics/threat-intelligence/rss', 'public_research', 94],
  ['Cloudflare Blog', 'https://blog.cloudflare.com/rss/', 'security_vendor', 90],
  ['AWS Security Blog', 'https://aws.amazon.com/blogs/security/feed/', 'security_vendor', 90],
  ['Cisco Talos', 'https://blog.talosintelligence.com/rss/', 'security_vendor', 90],
  ['Palo Alto Unit 42', 'https://unit42.paloaltonetworks.com/feed/', 'security_vendor', 90],
  ['Kaspersky Securelist', 'https://securelist.com/feed/', 'security_vendor', 84],
  ['ESET WeLiveSecurity', 'https://www.welivesecurity.com/en/rss/feed/', 'security_vendor', 86],
  ['Trend Micro Research', 'https://www.trendmicro.com/en_us/research/rss.xml', 'security_vendor', 86],
  ['Check Point Research', 'https://research.checkpoint.com/feed/', 'security_vendor', 86],
  ['BleepingComputer', 'https://www.bleepingcomputer.com/feed/', 'public_news', 84],
  ['The Hacker News', 'https://feeds.feedburner.com/TheHackersNews', 'public_news', 82],
  ['SecurityWeek', 'https://www.securityweek.com/feed/', 'public_news', 82],
  ['KrebsOnSecurity', 'https://krebsonsecurity.com/feed/', 'public_blog', 88],
  ['Dark Reading', 'https://www.darkreading.com/rss.xml', 'public_news', 82],
].map((source) => {
  if (!Array.isArray(source)) return source;
  const [name, url, sourceType, reliability] = source;
  return {
    id: `grey-${intelligenceHash([url]).slice(0, 14)}`,
    name,
    provider: 'rss',
    type: 'rss',
    url,
    source_type: sourceType,
    category: 'المصادر الرمادية',
    language: 'en',
    priority: reliability,
    reliability_score: reliability,
    data_sensitivity: 'مؤشر تسريب',
    enabled: true,
  };
});

export function buildArabicSeedSources() {
  const rssSources = ARABIC_RSS_SOURCES.map(([name, url, sourceType, reliability]) => ({
    id: `arabic-rss-${intelligenceHash([url]).slice(0, 14)}`,
    name,
    provider: 'rss',
    type: 'rss',
    url,
    query: '',
    source_type: sourceType,
    category: 'أخبار عامة',
    category_mode: 'infer',
    intelligence_scope: 'arabic',
    language: 'ar',
    priority: reliability,
    reliability_score: reliability,
    enabled: true,
    fetchIntervalMinutes: 30,
  }));
  const gdeltQueries = ARABIC_GDELT_QUERIES.map(([name, query, category]) => ({
    id: `arabic-gdelt-${intelligenceHash([query]).slice(0, 14)}`,
    name: `GDELT عربي: ${name}`,
    provider: 'gdelt',
    type: 'gdelt',
    url: GDELT_URL,
    query: `${query} sourcelang:Arabic`,
    source_type: 'gdelt_query',
    category,
    category_mode: 'fixed',
    intelligence_scope: 'arabic',
    language: 'ar',
    priority: 86,
    reliability_score: 78,
    enabled: true,
  }));
  const media = ARABIC_MEDIA_SOURCES.map(([name, domain, sourceType, reliability]) => ({
    id: `arabic-media-${intelligenceHash([name]).slice(0, 14)}`,
    name,
    provider: 'gdelt',
    type: 'gdelt',
    url: GDELT_URL,
    query: `domain:${String(domain).split('/')[0]} sourcelang:Arabic`,
    source_type: sourceType,
    category: 'أخبار عامة',
    category_mode: 'infer',
    intelligence_scope: 'arabic',
    language: 'ar',
    priority: reliability,
    reliability_score: reliability,
    enabled: true,
  }));
  return [...rssSources, ...gdeltQueries, ...media];
}

export function buildGreySeedSources() {
  return GREY_SECURITY_SOURCES.map((source) => ({
    ...source,
    intelligence_scope: 'grey',
    fetchIntervalMinutes: 60,
    query: '',
  }));
}
