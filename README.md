# SkipTheBoard

> The best tech jobs aren't on job boards. They're hiding in LinkedIn posts.

A community-driven job discovery platform. We watch real hiring managers — founders, VPs, team leads — across LinkedIn and X. Whenever they post a job, we capture it and display it in our feed — ranked by the community through upvotes and downvotes. No job boards. Just real jobs from the people actually hiring.

**Live:** [skiptheboard.in](https://skiptheboard.in)

## How It Works

1. **We watch** — Our system monitors hiring posts from real decision-makers on LinkedIn and X.
2. **We display** — Every captured post appears in the feed with the original author, role, company, and a direct link to the source.
3. **You vote** — Upvote quality posts (real hiring managers, clear roles) and downvote spam (recruiters, vague listings).
4. **Posts expire** — Jobs auto-expire after 30 days. Fresh stuff only.

## Project Structure

```
HireGene/
├── frontend/              # Next.js 16 app (React 19, TypeScript, Tailwind CSS 4)
│   ├── src/app/           # App Router — pages, layout, global styles
│   ├── src/components/    # UI components (JobCard, UpvoteButton, Sidebar, SocialProof)
│   └── src/lib/           # Data types, constants, config, API client, mock data
├── backend/               # Hono API server (Prisma, PostgreSQL, Apify, Groq)
│   ├── api/               # Vercel serverless entry point ([[...route]].ts)
│   ├── prisma/            # Database schema and migrations
│   ├── src/routes/        # API routes (posts, admin, submissions)
│   ├── src/lib/           # Prisma client, Apify scraper, LLM classifier, config
│   └── scripts/           # Utility scripts (avatar updates, etc.)
├── DEPLOYMENT.md          # Full deployment guide (frontend + backend)
└── README.md
```

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Google Analytics 4
- **Backend:** Hono, Prisma, PostgreSQL, Apify (LinkedIn/X scraping), Groq (AI enrichment)
- **Deployment:** Vercel (both frontend and backend)

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Environment variables:**
- `NEXT_PUBLIC_BACKEND_URL` — Backend API URL
- `NEXT_PUBLIC_API_KEY` — API key for backend requests
- `NEXT_PUBLIC_GA_ID` — Google Analytics 4 Measurement ID (e.g. `G-XXXXXXXXXX`)

### Backend

```bash
cd backend
npm install
npx prisma migrate deploy
npm run dev
```

**Environment variables:**
- `DATABASE_URL` — PostgreSQL connection string
- `API_KEY` — Shared API key for feed endpoints
- `ADMIN_SECRET` — Bearer token for admin endpoints
- `APIFY_API_KEY` — Apify API key for LinkedIn/X scraping
- `GROQ_API_KEY` — Groq API key for AI-powered post enrichment
- `CORS_ORIGIN` — Allowed frontend origin(s), comma-separated

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/posts/recent` | API key | Fetch filtered/sorted job feed |
| POST | `/api/posts/:id/vote` | Public | Upvote/downvote a job (IP-based dedup) |
| POST | `/api/submit` | Public | Submit a recruiter suggestion |
| GET | `/api/admin/recruiters` | Admin | List all tracked recruiters |
| POST | `/api/admin/recruiter` | Admin | Add a new recruiter |
| POST | `/api/admin/scrape` | Admin | Trigger manual scrape |
| GET | `/api/admin/submissions` | Admin | List community submissions |
| POST | `/api/admin/submissions/:id/approve` | Admin | Approve a submission |
| POST | `/api/admin/submissions/:id/reject` | Admin | Reject a submission |
| DELETE | `/api/admin/jobs` | Admin | Clear jobs (expired/all/older than N days) |

## Deployment

Both frontend and backend are deployed on Vercel.

- **Frontend:** [skiptheboard.in](https://skiptheboard.in) (custom domain via GoDaddy)
- **Backend:** [backend-umber-nu-43.vercel.app](https://backend-umber-nu-43.vercel.app)

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete step-by-step instructions.

## Redeploy After Changes

```bash
# Frontend
cd frontend && npx vercel --prod --yes

# Backend
cd backend && npx vercel --prod --yes
```
