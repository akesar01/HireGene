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
4. **Posts expire** — Jobs auto-expire after 7 days. Fresh stuff only.

## Core Principles

- **Signal over noise** — Only posts from actual hiring managers (founders, heads, leads, the person you'd DM).
- **Community-ranked** — Your votes decide what stays at the top. No paid placements.
- **Transparent sourcing** — Every post links back to the original LinkedIn/X post. We don't rewrite or editorialize.
- **Fresh only** — 7-day auto-expiry keeps the feed relevant.

## Project Structure

```
HireGene/
├── frontend/          # Next.js 16 app (React 19, TypeScript, Tailwind CSS 4)
│   ├── src/app/       # App Router — pages, layout, global styles
│   ├── src/components/  # UI components (JobCard, FilterPill, VoteButton, Sidebar)
│   └── src/lib/       # Data types, constants, mock data, utility functions
├── backend/           # (planned) API server for ingestion, auth, voting, storage
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
- **Posted time** — relative (e.g. "2h ago"), auto-expires after 7 days

## Backend (Planned)

The frontend currently uses mock data (`frontend/src/lib/data.ts`). When the backend is ready:
- Replace mock data imports with API fetch calls
- Implement: post ingestion, user auth, voting, commenting, expiry cron
- Keep the API contract aligned with the `Job` interface in `src/lib/data.ts`
