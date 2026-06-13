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

