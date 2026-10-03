<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# HireGene

## What is HireGene?

HireGene is a community-driven job discovery platform. We watch recruiters and hiring managers across LinkedIn and X (Twitter) so you don't have to. Whenever they post a job, we capture it and display it in our feed — ranked by the community through upvotes and downvotes.

## The Problem

The best jobs in tech aren't on job boards. They're buried in social media posts by founders, VPs, and team leads who are actually hiring. Most of those posts vanish within a day. HireGene collects them in one place, in real time.

## How It Works

1. **We watch** — Our system monitors hiring posts from real decision-makers on LinkedIn and X.
2. **We display** — Every captured post appears in the feed with the original author, their role, the company, job details, and a link to the original post.
3. **You vote** — The community upvotes quality posts (real hiring managers, clear roles) and downvotes spam (recruiters, vague listings).
4. **Posts expire** — Jobs auto-expire after 30 days. Fresh stuff only.

## Core Principles

- **Signal over noise** — Only posts from actual hiring managers (founders, heads, leads, the person you'd DM).
- **Community-ranked** — Your votes decide what stays at the top. No paid placements.
- **Transparent sourcing** — Every post links back to the original LinkedIn/X post. We don't rewrite or editorialize.
- **Fresh only** — 30-day auto-expiry keeps the feed relevant.

## Project Structure

```
HireGene/
├── frontend/          # Next.js 16 app (React 19, TypeScript, Tailwind CSS 4)
│   ├── src/app/       # App Router — pages, layout, global styles
│   ├── src/components/  # UI components (JobCard, FilterPill, VoteButton, Sidebar)
│   └── src/lib/       # Data types, constants, config, mock data, utility functions
├── backend/           # Hono API server (Prisma, PostgreSQL, Apify, Groq)
│   ├── api/           # Vercel serverless entry point ([[...route]].ts)
│   ├── prisma/        # Database schema and migrations
│   ├── src/           # Routes, lib, OpenAPI spec
│   └── scripts/       # Utility scripts (avatar updates, etc.)
├── DEPLOYMENT.md      # Full deployment guide (frontend + backend)
└── README.md
```

## Frontend Tech

- **Next.js 16** (App Router, server components, async `searchParams`)
- **React 19**
- **TypeScript** (strict)
- **Tailwind CSS 4** (design tokens via `@theme inline`)
- **Inter** font (Google Fonts)

## Data Model

Each job post contains:
- **Author info** — name, title, avatar initial
- **Role badge** — e.g. "Software Engineer - Database Internals @ Google"
- **Job title & description** — bullet-pointed preview
- **Tags** — role family, seniority, remote mode, tech stack
- **Source** — LinkedIn or X, with direct link to original post
- **Score** — community votes (upvote/downvote)
- **Comments count**
- **Posted time** — relative (e.g. "2h ago"), auto-expires after 30 days

## Backend

The backend is a Hono app with Prisma + PostgreSQL. It provides:
- Post ingestion via Apify (LinkedIn/X scraping)
- Recruiter suggestions (community submissions)
- Voting on job posts
- Admin endpoints (`ADMIN_SECRET` bearer, or a Clerk admin per `ADMIN_USER_IDS` / `ADMIN_EMAILS`)
- AI-powered post enrichment via Groq

The frontend fetches jobs from the backend API. The API contract is aligned with the `Job` interface in `frontend/src/lib/data.ts`.

Ingest path: `ingestPosts` in `backend/src/lib/apify.ts` -> `classifyPost` (`llm-classifier.ts`, regex fallback in `classifier.ts`) -> `inferCompany` (`extract-company.ts`) -> deterministic gates in `backend/src/lib/ingest-gates.ts` -> `prisma.job.create`. The feed is engineering-only by default (`INGEST_ROLE_FAMILIES`); skip reasons and the `scripts/reclassify-jobs.ts` cleanup are documented under "Ingest quality gates" in `DEPLOYMENT.md`. Add any new junk pattern as a failing test in `backend/tests/` first; the gates are pure functions and must never call the LLM.

Email nudges: `runCampaign` in `backend/src/lib/nudge-send.ts` -> `selectJobsForUser` (`nudge-select.ts`, pure: re-applies `evaluateJobGates`, lifts SDE-3/5+ year roles to senior, excludes jobs already sent) -> `renderNudgeEmail` (`nudge-render.ts`, plain HTML + text) -> `EmailProvider` (`email.ts`, Resend or dry run without `RESEND_API_KEY`). Recipients are Clerk users with a Mongo profile; their emails come from Clerk, never from the resume. Admin access is `ADMIN_USER_IDS` / `ADMIN_EMAILS` (`admin-auth.ts`); the dashboard at `frontend/src/app/admin/` never sees `ADMIN_SECRET`. Operations, env vars, DNS and the cron list are under "Match-based email nudges" in `DEPLOYMENT.md`. Tests mock Prisma with `backend/tests/helpers/fake-prisma.ts`.

Frontend config (`frontend/src/lib/config.ts`) centralizes `BACKEND_URL` and `API_KEY` — all client-side fetches import from there.

## Deployment (Vercel)

Both frontend and backend are deployed on Vercel.

- **Frontend**: Next.js app, auto-detected by Vercel. Custom domain: `https://skiptheboard.in`
- **Backend**: Hono app deployed as Vercel Serverless Functions via `api/[[...route]].ts` catch-all entry point.

### Deployment URLs

- Frontend: `https://skiptheboard.in` (custom domain via GoDaddy)
- Frontend (Vercel): `https://frontend-seven-lilac-71.vercel.app`
- Backend: `https://backend-umber-nu-43.vercel.app`

### Full deployment guide

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete step-by-step instructions including:
- Environment variable setup
- Custom domain configuration (GoDaddy + Vercel)
- Backend deployment gotchas & fixes (ESM, Prisma, catch-all routing, CORS)
- Local development setup
- Redeploy commands

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
