# Deployment Guide

Both frontend and backend are deployed on Vercel.

## Deployment URLs

| Service  | URL                                          |
|----------|----------------------------------------------|
| Frontend | `https://skiptheboard.in`                    |
| Frontend | `https://frontend-seven-lilac-71.vercel.app` |
| Backend  | `https://backend-umber-nu-43.vercel.app`     |

---

## Frontend Deployment (Next.js)

### Prerequisites

- Vercel CLI installed (`npm i -g vercel`)
- Project linked to Vercel (`npx vercel link`)

### Environment Variables

Set in Vercel dashboard or via CLI:

```bash
npx vercel env add NEXT_PUBLIC_BACKEND_URL production
# Value: https://backend-umber-nu-43.vercel.app

npx vercel env add API_KEY production
# Value: must match backend's API_KEY
```

### Deploy

```bash
cd frontend
npx vercel --prod --yes
```

Vercel auto-detects Next.js — no special build config needed.

### Custom Domain

Domain `skiptheboard.in` is registered at GoDaddy and configured as:

1. **GoDaddy DNS:**
   - A record `@` → `76.76.21.21` (Vercel's universal IP)
   - CNAME `www` → `cname.vercel-dns.com`
   - Nameservers: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`

2. **Vercel:**
   - Domain added via `npx vercel domains add skiptheboard.in`
   - `www.skiptheboard.in` added and set to redirect to `skiptheboard.in`
   - SSL auto-provisioned by Vercel

### Local Development

Create `frontend/.env.local`:

```
NEXT_PUBLIC_BACKEND_URL="http://localhost:8787"
API_KEY="hiregene-api-key-dev"
```

Run dev server:

```bash
cd frontend
npm run dev
```

---

## Backend Deployment (Hono + Prisma)

### Prerequisites

- Vercel CLI installed
- Project linked to Vercel (`npx vercel link`)
- PostgreSQL database accessible via `DATABASE_URL`

### Environment Variables

Set in Vercel dashboard or via CLI:

```bash
npx vercel env add DATABASE_URL production
npx vercel env add APIFY_TOKEN production
npx vercel env add ADMIN_SECRET production
npx vercel env add CRON_SECRET production
npx vercel env add API_KEY production
npx vercel env add CORS_ORIGIN production
npx vercel env add GROQ_API_KEY production
npx vercel env add GROQ_MODEL production
# Value: openai/gpt-oss-120b
npx vercel env add APIFY_MAX_CONCURRENT production
# Value: 5
npx vercel env add INGEST_ROLE_FAMILIES production
# Optional. Value: engineering,ai_ml (default). Comma-separated RoleFamily values allowed into the feed.
```

**`CORS_ORIGIN`** must be a comma-separated list of allowed origins:

```
https://skiptheboard.in,https://frontend-seven-lilac-71.vercel.app
```

The backend CORS middleware (`src/index.ts`) splits this value on commas and checks each request's `Origin` header against the list.

### Deploy

```bash
cd backend
npx vercel --prod --yes
```

### Local Development

Create `backend/.env`:

```
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
APIFY_TOKEN="your_apify_token"
ADMIN_SECRET="your_admin_secret"
CRON_SECRET="your_cron_secret"
API_KEY="hiregene-api-key-dev"
CORS_ORIGIN="http://localhost:3000"
GROQ_API_KEY="your_groq_api_key"
```

Run dev server:

```bash
cd backend
npm run dev
```

### Daily recruiter scrape

`backend/vercel.json` registers a Vercel Cron that hits `GET /api/cron/scrape` every 15 minutes. Vercel sends `Authorization: Bearer $CRON_SECRET` when that env var is set.

The endpoint starts at most 5 due recruiters per tick (Apify Free concurrent cap), then if more remain it waits 10 minutes and starts the next 5, until everyone due that day is scraped. Unfinished Apify runs stay `RUNNING` and are ingested on a later tick. Set `APIFY_WAIT_MS` (default 180000) if a manual admin scrape should wait longer in-request.

Manual trigger (same auth as admin works too):

```bash
curl -X POST https://backend-umber-nu-43.vercel.app/api/cron/scrape \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

Use `?once=1` to scrape a single due recruiter and stop.

### Ingest quality gates

Every scraped post passes through deterministic gates in `backend/src/lib/ingest-gates.ts` before it becomes a `Job`. A post is skipped, and counted in `ApifyRunLog.errorMsg` (for example `not_job=3,off_target=2,duplicate=1`), for one of these reasons:

| Skip reason | Meaning |
|-------------|---------|
| `no_url` | The Apify row had no post URL. |
| `not_job` | The classifier (Groq, or the regex fallback without `GROQ_API_KEY`) did not see a concrete open role. A post that cannot name a title is never a job. |
| `expired` | Posted more than `JOB_EXPIRY_DAYS` ago. |
| `off_target` | The role family is not in `INGEST_ROLE_FAMILIES` (default `engineering,ai_ml`), or the title is a sales engineer, solutions engineer or consultant, pre-sales, customer success, support engineer, recruiter, or talent role. |
| `unparseable` | The title is empty, under three letters, mostly punctuation or pipes, or a location line, and the post text names no role either. |
| `duplicate` | Same `sourceUrl` with unchanged content, or an unexpired job from the same recruiter with the same normalized title and company posted within 14 days. |

Companies that look like sentence fragments or cities are replaced by the company in the recruiter headline, else `Unknown`; that is a repair, not a skip.

### Cleaning existing rows

`backend/scripts/reclassify-jobs.ts` applies the same gates to every stored job using only the stored fields (no LLM calls). Dry run by default; it prints one line per job with `keep` or `delete` and the reason, then a summary.

```bash
cd backend
npx tsx scripts/reclassify-jobs.ts            # dry run
npx tsx scripts/reclassify-jobs.ts --apply    # delete failing rows (plus their votes and applications) and repair titles and companies
```

`INGEST_ROLE_FAMILIES` is honoured here too. Run the dry run first and read the list before applying.

---

## Backend Deployment — Gotchas & Fixes

### 1. `build` script must NOT be `vercel build`

Vercel runs `npm run build` during its own build process. If the script calls `vercel build`, it fails with exit code 127 (`vercel` binary not available inside the build step).

**Fix:** Set `"build": "prisma generate"` in `package.json` so the Prisma client is generated during build.

### 2. ESM requires `"type": "module"` in `package.json`

The Hono backend uses ES module imports (`import ... from ...`). Without `"type": "module"`, Node.js on Vercel treats compiled JS as CommonJS and throws `SyntaxError: Cannot use import statement outside a module`.

**Fix:** Add `"type": "module"` to `package.json`.

### 3. ESM requires `.js` extensions on relative imports

Unlike bundler resolution (Webpack/tsx), Node.js ESM does not resolve extensionless relative paths. All relative imports must include `.js`:

```ts
// Correct
import { prisma } from "../lib/prisma.js";

// Wrong — will fail on Vercel
import { prisma } from "../lib/prisma";
```

Also set `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` in `tsconfig.json`.

### 4. Vercel catch-all routing for deep paths

The `api/[[...route]].ts` optional catch-all only handles paths up to 2 segments under `/api/` (e.g. `/api/posts` works, but `/api/posts/recent` returns 404).

**Fix:** Add rewrites in `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/[[...route]]" },
    { "source": "/(health|docs)", "destination": "/api/[[...route]]" }
  ],
  "functions": {
    "api/**/*.ts": { "maxDuration": 120 }
  },
  "crons": [
    { "path": "/api/cron/scrape", "schedule": "0 4 * * *" }
  ]
}
```

### 5. Environment variables must be set on Vercel

Set via `npx vercel env add <NAME> production` or the Vercel dashboard. After adding env vars, **redeploy** for them to take effect.

### 6. CORS_ORIGIN must include all frontend domains

The backend's `CORS_ORIGIN` env var must include every domain the frontend is served from. Use comma-separated values:

```
https://skiptheboard.in,https://frontend-seven-lilac-71.vercel.app
```

If a frontend domain is missing, browser requests will fail with `net::ERR_FAILED` due to CORS rejection.

### 7. Frontend env vars must use `NEXT_PUBLIC_` prefix

Client-side components (like `submit/page.tsx` and `UpvoteButton.tsx`) can only access env vars prefixed with `NEXT_PUBLIC_`. The shared config at `frontend/src/lib/config.ts` reads `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_API_KEY` / `API_KEY`.

---

## Redeploy After Changes

After updating env vars or code changes:

```bash
# Frontend
cd frontend && npx vercel --prod --yes

# Backend
cd backend && npx vercel --prod --yes
```
