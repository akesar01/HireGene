# HireGene

A community-driven job discovery platform. We watch recruiters and hiring managers across LinkedIn and X so you don't have to. Whenever they post a job, we capture it and display it in our feed — ranked by the community through upvotes and downvotes.

## Project Structure

```
HireGene/
├── frontend/          # Next.js app (UI, components, mock data)
│   ├── src/
│   │   ├── app/       # Next.js App Router pages
│   │   ├── components/  # React components
│   │   └── lib/       # Types, constants, utilities
│   └── package.json
├── backend/           # (planned) API server
└── README.md
```

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Backend

Coming soon. The frontend currently uses mock data in `frontend/src/lib/data.ts`. When the backend is ready, replace the mock data imports with API calls.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend:** TBD
# HireGene
