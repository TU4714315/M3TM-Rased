# النشر والتشغيل

## المتغيرات

```dotenv
NEWS_API_KEY=
GITHUB_TOKEN=
GDELT_ENABLED=true
HACKERNEWS_ENABLED=true
GITHUB_NEWS_ENABLED=true
RSS_NEWS_ENABLED=true
ARABIC_NEWS_ENABLED=true
GREY_INTEL_ENABLED=true
NEWS_REFRESH_INTERVAL_MINUTES=60
NEWS_MAX_ITEMS_PER_FETCH=100
NEWS_DEFAULT_LANGUAGE=ar
NEWS_FETCH_TIMEOUT_SECONDS=15
ENABLE_LEAK_METADATA_ONLY=true
ENABLE_DARKWEB_DIRECT_ACCESS=false
ENABLE_PRIVATE_SOURCE_SCRAPING=false
```

لا تضع المفاتيح في Vite أو الواجهة. استخدم GitHub Secrets أو Google Secret
Manager واربطها بخدمة Cloud Run.

## محليًا

```bash
npm ci
npm run dev
npm run sync:intelligence
npm run serve:api
```

## الفحص

```bash
npm audit
npm run lint
npm test
npm run test:rules
npm run build
npm run test:e2e
```

## Firebase

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes,hosting \
  --project m3tm-rased-07246627-7b0bf
```

## Cloud Run

قبل أول نشر، يجب أن يملك الحساب المنفذ صلاحية
`serviceusage.services.enable`، ثم تفعيل الخدمات:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project m3tm-rased-07246627-7b0bf
```

حساب Firebase Admin SDK المستخدم حاليًا للنشر لا يملك هذه الصلاحية. نفذ التفعيل
مرة واحدة بحساب Owner أو Service Usage Admin، ثم أعد تشغيل workflow:
`Deploy intelligence API to Cloud Run`.

```bash
gcloud run deploy m3tm-intelligence-api \
  --source . \
  --region us-central1 \
  --project m3tm-rased-07246627-7b0bf \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=m3tm-rased-07246627-7b0bf,NEWS_DEFAULT_LANGUAGE=ar,ARABIC_NEWS_ENABLED=true,GREY_INTEL_ENABLED=true,ENABLE_LEAK_METADATA_ONLY=true,ENABLE_DARKWEB_DIRECT_ACCESS=false,ENABLE_PRIVATE_SOURCE_SCRAPING=false
```

الخدمة تسمح بالوصول الشبكي العام، لكن كل مسار وظيفي يتحقق من Firebase ID token
والدور. مسار الجدولة يستخدم `SCHEDULER_SECRET`.

## Cloud Scheduler

```bash
gcloud scheduler jobs create http m3tm-intelligence-refresh \
  --schedule="*/15 * * * *" \
  --uri="https://SERVICE_URL/internal/scheduler/refresh" \
  --http-method=POST \
  --headers="x-m3tm-scheduler-key=SCHEDULER_SECRET" \
  --location=us-central1
```

يفضل تخزين سر الجدولة في Secret Manager واستخدام تكامل OIDC في بيئات الإنتاج.

## نقل النطاق إلى Firebase Hosting

النطاق مهيأ داخل Firebase Auth وFirebase Hosting. عند نقل الإنتاج من GitHub
Pages إلى Firebase:

1. احذف سجلات `A` الأربعة الخاصة بـGitHub Pages من `m3tm.app`.
2. أضف `A` بقيمة `199.36.158.100` إلى `m3tm.app`.
3. أضف `TXT` بقيمة `hosting-site=m3tm-rased-07246627-7b0bf` إلى `m3tm.app`.
4. استبدل `www.m3tm.app CNAME m3tm.github.io` بـ
   `m3tm-rased-07246627-7b0bf.web.app`.
5. بعد صدور شهادة Firebase وظهور `HOST_ACTIVE`، احذف الدومين المخصص من
   إعدادات GitHub Pages حتى يبقى رابط GitHub الاحتياطي على نطاق `github.io`.

لا تحذف سجلات GitHub قبل إضافة سجلات Firebase، لتقليل فترة انقطاع النطاق.

