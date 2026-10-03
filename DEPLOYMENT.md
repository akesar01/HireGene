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

# Email nudges (see "Match-based email nudges" below)
npx vercel env add RESEND_API_KEY production
# Optional. Without it every send is a dry run: rendered and recorded, nothing leaves the server.
npx vercel env add RESEND_WEBHOOK_SECRET production
# Signing secret of the Resend webhook endpoint (starts with whsec_). Without it POST /api/email/webhook returns 503.
npx vercel env add EMAIL_FROM production
# Value: SkipTheBoard Jobs <jobs@mail.skiptheboard.in> (default when unset)
npx vercel env add UNSUBSCRIBE_SECRET production
# Random 32+ char string. Signs the one-click unsubscribe links; rotating it invalidates links in already-sent emails.
npx vercel env add ADMIN_USER_IDS production
# Comma-separated Clerk user ids allowed into /admin. Either this or ADMIN_EMAILS must list the captain.
npx vercel env add ADMIN_EMAILS production
# Comma-separated primary Clerk emails allowed into /admin (case-insensitive). Resolved through @clerk/backend.
npx vercel env add FRONTEND_URL production
# Value: https://skiptheboard.in — origin used in email links and the /go redirect fallback.
```

`CLERK_SECRET_KEY` and `MONGODB_URI` are already required for sign-in and profiles; the nudges reuse them for recipient emails and resume profiles.

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

`backend/vercel.json` registers a Vercel Cron that hits `GET /api/cron/scrape` once a day at 04:00 UTC. Vercel sends `Authorization: Bearer $CRON_SECRET` when that env var is set.

The endpoint starts at most 5 due recruiters per tick (Apify Free concurrent cap), then if more remain it waits 10 minutes and starts the next 5, until everyone due that day is scraped. Unfinished Apify runs stay `RUNNING` and are ingested on a later tick. Set `APIFY_WAIT_MS` (default 180000) if a manual admin scrape should wait longer in-request.

Manual trigger (same auth as admin works too):

```bash
curl -X POST https://backend-umber-nu-43.vercel.app/api/cron/scrape \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

Use `?once=1` to scrape a single due recruiter and stop.

### Match-based email nudges

Signed-in users with a resume profile get an email with the jobs on the board that best match their resume. Everything lives behind `backend/src/lib/email.ts` (provider), `nudge-select.ts` (pure ranking, senior override, gates), `nudge-render.ts` (plain HTML + text template) and `nudge-send.ts` (campaign runner). The send path never calls an LLM.

**Crons (`backend/vercel.json`, 3 total, all daily or slower as Vercel Hobby requires):**

| Path | Schedule (UTC) | What it does |
|------|----------------|--------------|
| `/api/cron/expire-jobs` | `0 3 * * *` | Delete jobs older than `JOB_EXPIRY_DAYS`. |
| `/api/cron/scrape` | `0 4 * * *` | Daily recruiter scrape (drains through GitHub Actions). |
| `/api/cron/nudges` | `30 2 * * *` | 08:00 IST. On Mondays it creates and runs the weekly campaign for every subscribed user; on other days it runs a daily campaign only for users who chose daily. Hobby fires it within the hour. |

A run processes recipients in pages of 100 (one Resend batch call each). If the 240 s budget (`NUDGE_BUDGET_MS`) runs out it POSTs itself `/api/cron/nudges?campaign=<id>` with `CRON_SECRET` via `waitUntil`, so a long send continues in a fresh invocation. The `(campaign, user)` unique index makes any retry safe. **The schedule starts paused.** On a fresh deployment there is no `nudges.schedule_paused` row in `app_settings`, and the cron treats that as paused: it creates no campaign and nothing goes out on its own until an admin presses "Resume schedule" under Send controls (which stores `false`). "Pause schedule" stores `true` again. "Send now" and test sends from the dashboard work either way.

**Dry run.** With no `RESEND_API_KEY`, sends are rendered and recorded with status `dry_run` and the admin preview, test send and campaigns all work. Nothing is ever sent from tests.

**Resend setup.**

1. Domain `mail.skiptheboard.in` is added in Resend in region **ap-northeast-1 (Tokyo)**. Its DNS records are already in place. Because skiptheboard.in's nameservers are Vercel's (`ns1/ns2.vercel-dns.com`), any email DNS change goes into **Vercel → Domains → skiptheboard.in → DNS Records**, not GoDaddy. The records Resend requires are: a TXT at `resend._domainkey.mail` (DKIM), an MX plus a TXT at `send.mail` (SPF / return path), and a TXT at `_dmarc` (`v=DMARC1; p=none; rua=mailto:<reporting inbox>`, tighten to `p=quarantine` after a few clean weeks). Copy the exact values from the Resend domain page.
2. Webhook: in Resend → Webhooks add `https://backend-umber-nu-43.vercel.app/api/email/webhook` with the events `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained` (sent and delivery_delayed are accepted and ignored). Paste the endpoint's signing secret into `RESEND_WEBHOOK_SECRET` and redeploy. Signatures are verified with Svix; events are deduplicated by `svix-id`.
3. Every email carries `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) pointing at `POST /api/email/unsubscribe?t=<signed token>`, plus a footer link to `https://skiptheboard.in/unsubscribe?t=…` (the page asks for one click before it acts). Test sends carry neither the headers nor a working footer link. Hard bounces and complaints unsubscribe the user automatically.

**Click tracking.** Job links go to `https://skiptheboard.in/go/<sendId>/<jobId>`; the Next route forwards to the backend `GET /go/...` (rewrite in `vercel.json`), which logs a `nudge_clicks` row and 302s to the LinkedIn post. Site links carry `utm_source=nudge&utm_medium=email&utm_campaign=<campaign key>`.

**Admin dashboard.** `https://skiptheboard.in/admin` renders only for Clerk users in `ADMIN_USER_IDS` / `ADMIN_EMAILS`; every `/api/admin/*` call is checked on the backend (the machine `ADMIN_SECRET` still works for curl and scripts, but is never sent to a browser). Tabs: Subscribers, Email performance, Jobs & site, Send controls (preview any user, test send, send now, pause/resume), Experiments (2+ variants with weights and an optional holdout, results side by side), Submissions, Hiring managers.

**Migration.** `backend/prisma/migrations/20261002090000_add_email_nudges` adds `email_preferences`, `campaigns`, `campaign_variants`, `nudge_sends`, `nudge_clicks`, `email_events` and `app_settings`. Apply with `npx prisma migrate deploy` against production before the first send.

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
