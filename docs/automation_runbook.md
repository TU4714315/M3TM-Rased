# التشغيل الآلي لـ M3TM RASED

تمت إضافة تشغيل آلي عبر GitHub Actions حتى لا تبقى تغييرات الواجهة في الكود فقط دون ظهورها في الموقع.

## الملفات

- `.github/workflows/auto-deploy.yml`
- `.github/workflows/auto-sync-intelligence.yml`

## ماذا يحدث تلقائيًا؟

عند الدفع إلى `main` أو التشغيل اليدوي:

1. تثبيت الحزم بـ `npm ci`.
2. تشغيل الفحص `npm run lint`.
3. تشغيل الاختبارات `npm test`.
4. بناء الواجهة `npm run build`.
5. نشر Firestore rules/indexes و Firebase Hosting.

كل 15 دقيقة أو بالتشغيل اليدوي:

1. تشغيل `npm run sync:intelligence`.
2. مزامنة الأخبار العربية والمؤشرات الرمادية.

## السر المطلوب

يجب إضافة هذا السر في GitHub Actions Secrets:

```text
FIREBASE_SERVICE_ACCOUNT_M3TM_RASED
```

الأسرار الاختيارية:

```text
NEWS_API_KEY
GITHUB_TOKEN
```

## أين أشغلها؟

GitHub → M3TM-Rased → Actions → اختر workflow → Run workflow.

## إذا تغير الكود ولم يتغير الموقع

افحص:

1. هل workflow أخضر؟
2. هل `npm run build` نجح؟
3. هل deploy نجح؟
4. هل فتحت رابط Firebase Hosting الصحيح؟
5. جرّب تحديث قوي للمتصفح أو أضف `?v=commit-sha` للرابط.
