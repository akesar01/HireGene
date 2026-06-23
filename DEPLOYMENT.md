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
npx vercel env add API_KEY production
npx vercel env add CORS_ORIGIN production
npx vercel env add GROQ_API_KEY production
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
API_KEY="hiregene-api-key-dev"
CORS_ORIGIN="http://localhost:3000"
GROQ_API_KEY="your_groq_api_key"
```

Run dev server:

```bash
cd backend
npm run dev
```

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
    "api/**/*.ts": { "maxDuration": 60 }
  }
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
