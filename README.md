# M3TM.RASEED

مركز الرصد العربي: رصد. تحليل. تنبيه. تقرير.

يتضمن الإصدار الحالي **News & Repository Intelligence Hub** لجمع الأخبار من RSS وGDELT
وHacker News وGitHub وNewsAPI الاختياري، مع تقييم الصلة، استخراج المؤشرات، ذكاء
المستودعات، قوائم المراقبة، التنبيهات، التقارير والمهام.

يتضمن كذلك **مركز الرصد العربي** في `#/intelligence` مع تصنيف عربي، رصد إقليمي،
مؤشرات تسريب metadata-only، تقييم مخاطر، تقارير تنفيذية، ومصادر عربية تستخدم
GDELT كبديل موثوق عند غياب RSS.

## البنية

- Vite + TypeScript للواجهة.
- Firebase Authentication عبر Google أو البريد وكلمة المرور.
- Firestore للأخبار والمصادر والمستخدمين والدعوات وسجل المزامنة.
- GitHub Actions لجلب RSS/Atom والنشر إلى Firebase Hosting وGitHub Pages.
- عامل استخبارات متعدد المزودين وخدمة API اختيارية قابلة للنشر على Cloud Run.
- Hash routing حتى يعمل البناء نفسه على الاستضافتين.

## الصلاحيات

| الدور | الصلاحيات |
| --- | --- |
| Admin | إدارة المستخدمين والدعوات والمحتوى والمصادر والاستيراد والإعدادات |
| Manager | إدارة الأخبار والمصادر وطلب المزامنة |
| User | القراءة والبحث والتصدير |

لا يمنح إنشاء حساب Firebase وصولًا تلقائيًا. يجب أن يكون البريد مدعوًا، باستثناء مديري التهيئة:

- `moooom001@hotmail.com`
- `mohammed.e.z.m2@gmail.com`

## التشغيل

```bash
npm ci
npm run dev
```

الفحوص:

```bash
npm run lint
npm test
npm run test:rules
npm run build
npm run test:e2e
```

يتطلب اختبار القواعد Java 21 أو أحدث.

## مجموعات Firestore

- `users`
- `invites`
- `news`
- `sources`
- `syncRuns`
- `syncRequests`
- `settings`
- `news_items`, `news_sources`, `news_bookmarks`, `news_fetch_logs`
- `repo_intelligence_items`, `watchlists`, `watchlist_hits`, `alerts`
- `tasks`, `reports`, `repository_ideas`, `audit_logs`
- `grey_intel_items`, `grey_bookmarks`, `intelligence_reports`
- `source_reliability_scores`, `entities`, `topics`, `audit_events`

يتضمن مستند `settings/general` اسم المنصة، والتصنيف الافتراضي، ومفتاح تشغيل أو تعطيل مزامنة المصادر.

## مزامنة المصادر

تشغل `.github/workflows/sync-feeds.yml` المحرك كل 15 دقيقة. يقرأ المصادر النشطة، ويدعم RSS 2.0 وAtom، ويطبق:

- منع العناوين المحلية والخاصة.
- حد 12 ثانية للطلب.
- حد 2MB للاستجابة.
- ثلاثة تحويلات كحد أقصى.
- بصمة SHA-256 لمنع تكرار الأخبار.
- تسجيل نتيجة كل مصدر في `syncRuns`.

يلزم سر GitHub التالي:

```text
FIREBASE_SERVICE_ACCOUNT_M3TM_RASED
```

الأسرار الاختيارية:

```text
GITHUB_TOKEN
NEWS_API_KEY
```

يجب أن يحتوي JSON لحساب خدمة يملك الصلاحيات اللازمة لـFirestore وFirebase Hosting.

تهيئة مصادر مركز الرصد:

- من الواجهة: اضغط `تهيئة المصادر العربية` ثم `جلب الأخبار الآن`.
- للمؤشرات الآمنة: اضغط `تهيئة المصادر الرمادية`. تحفظ المنصة مؤشرات وملخصات فقط، ولا تخزن بيانات مسربة خام أو كلمات مرور.
- من الطرفية أو GitHub Actions: `npm run sync:intelligence`.

## النشر

عند الدمج إلى `main`:

1. تُشغل اختبارات lint والوحدات والبناء.
2. تُنشر قواعد Firestore والفهارس.
3. يُنشر `dist/` إلى Firebase Hosting.
4. يُنشر البناء نفسه إلى GitHub Pages كنسخة احتياطية.

يدعم المشروع Firebase Hosting وGitHub Pages. يجب أن يطابق هدف النشر الجهة التي يشير إليها `m3tm.app`، وأن يكون النطاق مضافًا إلى Firebase Authentication Authorized Domains.

## استيراد النسخة القديمة

من صفحة **الاستيراد** يستطيع Admin اختيار ملف JSON يحتوي:

```json
{
  "news": [],
  "sources": [],
  "exportedAt": "2026-06-07T00:00:00.000Z"
}
```

تعرض الواجهة معاينة قبل الكتابة، وتمنع التكرار باستخدام بصمات ثابتة.

يستطيع كل مستخدم مصرح له تصدير الأخبار والمصادر الحالية إلى JSON من الشريط العلوي.

## الأمان

- لا وصول مجهول إلى Firestore.
- التحقق من الأدوار موجود في القواعد وليس الواجهة فقط.
- لا توجد مفاتيح خدمة أو أسرار داخل المستودع.
- Firebase Web config عام بطبيعته، والحماية الفعلية في Auth وFirestore Rules.
- جميع البيانات الديناميكية تُعرض عبر DOM آمن، وتُرفض البروتوكولات غير الآمنة.
- Firebase Hosting يضيف CSP ورؤوس منع الإطارات وسياسة الصلاحيات.

## مركز الاستخبارات

- الواجهة: `#/news`
- مركز الرصد العربي: `#/intelligence`
- المؤشرات الرمادية: `#/grey-intel`
- التقارير التنفيذية: `#/reports`
- ذكاء المستودعات: `#/repositories/intelligence`
- قوائم المراقبة: `#/watchlists`
- التنبيهات: `#/alerts`
- المزامنة اليدوية: `npm run sync:intelligence`
- خدمة API المحلية: `npm run serve:api`

التوثيق الكامل: [docs/news_intelligence_hub.md](docs/news_intelligence_hub.md)

التوثيق العربي:

- [مركز الرصد العربي](docs/arabic_intelligence_hub.md)
- [المصادر الرمادية](docs/grey_sources_and_leak_indicators.md)
- [قوائم المراقبة والتنبيهات](docs/watchlists_and_alerts.md)
- [التقارير](docs/reporting.md)
- [النشر](docs/deployment.md)
