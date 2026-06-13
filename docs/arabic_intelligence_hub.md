# مركز الرصد العربي

## نظرة عامة

يوفر المسار `#/intelligence` لوحة عربية RTL للأخبار الإقليمية، مؤشرات المخاطر،
المصادر الرمادية العامة، المستودعات، قوائم المراقبة، التنبيهات، والتقارير.

المعالجة الخلفية تمر بالمراحل التالية:

1. قراءة المصادر المفعلة من `news_sources`.
2. التحقق من الرابط ومنع SSRF.
3. الجلب بمهلة وحد لحجم الاستجابة وإعادة محاولة محدودة.
4. التطبيع والتصنيف واستخراج الكيانات العربية.
5. حساب الأهمية والخطر والثقة.
6. منع التكرار بالبصمة.
7. الكتابة إلى `news_items` أو `grey_intel_items`.
8. فحص قوائم المراقبة وإنشاء `watchlist_hits` و`alerts`.

## التهيئة والجلب

من واجهة **مركز الرصد العربي**:

- `تهيئة المصادر العربية`
- `تهيئة المصادر الرمادية`
- `جلب الأخبار الآن`
- `جلب مؤشرات التسريبات`

الأزرار تنشئ طلبًا في `intelligence_requests`. تعالجه دورة GitHub Actions التالية.
يمكن التنفيذ الفوري من الخادم:

```bash
npm run sync:intelligence
```

أو عبر API للمستخدم Admin:

```text
POST /news/sources/seed-arabic
POST /news/fetch-arabic
POST /grey-intel/sources/seed
POST /grey-intel/fetch
```

تستخدم المصادر العربية GDELT مع مرشح اللغة العربية ومصادر نطاقية، لذلك لا تعتمد
المنصة على توفر RSS عربي لكل ناشر. فشل أي مصدر يسجل في `news_fetch_logs` ولا
يوقف بقية المصادر.

## المجموعات

- `news_items`
- `news_sources`
- `news_fetch_logs`
- `grey_intel_items`
- `repo_intelligence_items`
- `watchlists`
- `watchlist_hits`
- `alerts`
- `intelligence_reports`
- `source_reliability_scores`
- `entities`
- `topics`
- `audit_events`

## التصنيفات

التصنيفات والكلمات العربية موجودة في
`scripts/arabic-intelligence-lib.mjs`. يستخدم النظام تسمية
`الملف الشيعي السياسي` كسياق سياسي تحليلي، ولا يستخدم تصنيفًا دينيًا عامًا.

## معالجة الصفحة الفارغة

1. تأكد أن المستخدم Admin أو Manager.
2. اضغط تهيئة المصادر العربية ثم جلب الأخبار.
3. شغل `npm run sync:intelligence` إن لم تكن دورة Actions قد بدأت.
4. راجع `news_fetch_logs` و`lastError` في `news_sources`.
5. تحقق من وجود سر `FIREBASE_SERVICE_ACCOUNT_M3TM_RASED`.

