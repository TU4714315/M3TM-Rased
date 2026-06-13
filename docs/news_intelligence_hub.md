# News & Repository Intelligence Hub

## Overview

The M3TM intelligence hub aggregates public news and repository metadata, normalizes it,
scores relevance, extracts indicators, evaluates watchlists, and exposes the results in
the authenticated Arabic dashboard.

The implementation follows the existing architecture:

- Vite and TypeScript browser application.
- Firebase Authentication and Firestore.
- Firebase Admin workers in GitHub Actions.
- Optional Node.js HTTP API deployed to Cloud Run.
- Firebase Hosting and GitHub Pages for the frontend.

No provider key is shipped to the browser.

## Architecture

1. `.github/workflows/sync-intelligence.yml` runs every 15 minutes.
2. `scripts/sync-intelligence.mjs` selects sources whose configured interval has elapsed.
3. Provider adapters in `scripts/provider-client.mjs` fetch RSS, GDELT, Hacker News,
   GitHub, and optionally NewsAPI.
4. `scripts/intelligence-lib.mjs` normalizes, deduplicates, scores, and extracts entities.
5. Firestore stores items, repositories, logs, watchlist hits, and alerts.
6. The dashboard subscribes to authorized Firestore collections in real time.
7. `server/index.mjs` provides authenticated HTTP routes for external integrations.

## Firestore Collections

| Collection | Purpose |
| --- | --- |
| `news_items` | Unified normalized intelligence items |
| `news_sources` | Admin-managed providers, queries, priority, and intervals |
| `news_bookmarks` | Per-user saved news |
| `news_fetch_logs` | Provider fetch results and failures |
| `repo_intelligence_items` | Public GitHub repository research |
| `watchlists` | Keywords and entities monitored by users |
| `watchlist_hits` | Matches generated during ingestion |
| `alerts` | Dashboard alerts |
| `tasks` | Tasks created from news or repositories |
| `reports` | Draft reports built from selected intelligence |
| `repository_ideas` | Product ideas derived from repository research |
| `intelligence_requests` | Manual refresh requests |
| `audit_logs` | Source-management audit events |

The legacy `news`, `sources`, `syncRuns`, and related collections remain intact.

## HTTP API

Every route except `/health` and `/internal/scheduler/refresh` requires a Firebase ID token:

```text
Authorization: Bearer FIREBASE_ID_TOKEN
```

Main routes:

- `GET /news`
- `GET /news/{id}`
- `POST /news/fetch` (Admin)
- `POST /news/refresh` (Admin)
- `POST|DELETE /news/{id}/bookmark`
- `POST /news/{id}/summarize` (Admin or Manager)
- `POST /news/{id}/create-task`
- `POST /news/{id}/create-report`
- `POST /news/bulk-report`
- `GET|POST /news/sources`
- `PATCH|DELETE /news/sources/{id}`
- `GET /news/fetch-logs` (Admin)
- `GET /news/stats`
- `GET /repos/intelligence`
- `POST /repos/search`
- `POST /repos/{id}/save`
- `POST /repos/{id}/create-idea`
- `POST /repos/{id}/create-task`
- `GET /repos/ideas`
- `GET|POST /watchlists`
- `GET|PATCH|DELETE /watchlists/{id}`
- `GET /watchlists/{id}/hits`
- `GET /alerts`
- `POST /alerts/{id}/read`
- `POST /alerts/read-all`

`GET /news` accepts `q`, `category`, `source`, `provider`, `language`, `min_score`,
`date_from`, `date_to`, `page`, and `limit`.

## Environment Variables

Copy `.env.example` for local administration. Important values:

```text
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_M3TM_RASED=
GITHUB_TOKEN=
NEWS_API_KEY=
GDELT_ENABLED=true
HACKERNEWS_ENABLED=true
GITHUB_NEWS_ENABLED=true
RSS_NEWS_ENABLED=true
NEWS_REFRESH_INTERVAL_MINUTES=60
NEWS_MAX_ITEMS_PER_FETCH=100
NEWS_DEFAULT_LANGUAGE=en
NEWS_ALLOWED_SOURCES=
NEWS_FETCH_TIMEOUT_SECONDS=15
ALLOWED_ORIGINS=
SCHEDULER_SECRET=
```

`NEWS_API_KEY` is optional. GitHub works without a token at lower rate limits.
Production secrets should use GitHub Actions secrets or Google Secret Manager.

## Adding an RSS Source

Open `#/news` as Admin or Manager, expand **إدارة مصادر الاستخبارات**, then enter:

- Provider: RSS / Atom
- Public HTTPS feed URL
- Category and language
- Priority from 0 to 100
- Fetch interval from 15 to 1440 minutes

The URL is validated in the browser and resolved again by the worker. Local, private,
loopback, link-local, and cloud metadata addresses are rejected.

## Fetching and Searching

Manual worker run:

```bash
npm run sync:intelligence
```

Filter one provider:

```bash
NEWS_PROVIDER=github npm run sync:intelligence
```

The dashboard supports text, category, provider, score, and bookmark filters. The API
supports pagination and date filters.

## Reports and Tasks

Each news or repository card can create a task. News cards can create a Markdown report,
and multiple selected cards can be combined into one report. Documents are stored in
`tasks` and `reports` with the authenticated creator ID.

## Repository Intelligence

GitHub Search uses public repository metadata only. The worker stores stars, forks,
language, topics, license, activity, relevance, and extracted product ideas.

M3TM uses repositories for architectural research and inspiration. It does not copy
repository code, and any future reuse must verify the repository license.

## Local Development

```bash
npm ci
npm run dev
npm run serve:api
```

The API uses Application Default Credentials locally unless
`FIREBASE_SERVICE_ACCOUNT_M3TM_RASED` is provided.

## Cloud Run Deployment

```bash
gcloud run deploy m3tm-intelligence-api \
  --source . \
  --region us-central1 \
  --project m3tm-rased-07246627-7b0bf \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=m3tm-rased-07246627-7b0bf \
  --set-secrets GITHUB_TOKEN=GITHUB_TOKEN:latest,NEWS_API_KEY=NEWS_API_KEY:latest,SCHEDULER_SECRET=M3TM_SCHEDULER_SECRET:latest
```

The service remains application-authenticated even when Cloud Run permits public network
access: normal routes verify Firebase ID tokens, and the Scheduler route validates a
separate secret.

Cloud Scheduler example:

```bash
gcloud scheduler jobs create http m3tm-intelligence-refresh \
  --location us-central1 \
  --schedule "*/15 * * * *" \
  --uri "https://M3TM_API_URL/internal/scheduler/refresh" \
  --http-method POST \
  --headers "X-M3TM-Scheduler-Key=SCHEDULER_SECRET"
```

GitHub Actions already provides the preferred scheduler, so Cloud Scheduler is optional.

## Security

- Firebase ID token and active profile are required by the API.
- Admin and Manager checks are enforced server-side and in Firestore Rules.
- Provider requests use DNS-aware SSRF checks, response limits, timeouts, redirect limits,
  and retry backoff.
- Dynamic UI text is written through `textContent`.
- Provider secrets remain server-side.
- Source changes create audit records.
- Firestore list queries are capped.
- Alert and ingestion writes are server-only.

## Limitations and Next Improvements

- AI summaries currently use a deterministic extractive fallback. The service boundary is
  ready for an OpenAI or other LLM adapter.
- Person and organization extraction is conservative without an NLP model.
- Email and Telegram delivery are interfaces only; dashboard alerts are implemented.
- Firestore client filtering loads a capped recent window. Large deployments should use
  server-side cursor pagination exclusively.
- Provider availability and public feed URLs can change over time.
