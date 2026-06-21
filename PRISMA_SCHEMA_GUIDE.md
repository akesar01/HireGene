# Prisma Schema Explained + HireGene Design

## What is Prisma Schema?

Prisma schema is a **single source of truth** for your database structure. It's a declarative file (`schema.prisma`) that defines:

1. **Database connection** — what database you're using and where
2. **Models** — tables and their columns
3. **Relationships** — how tables connect (one-to-many, many-to-many, etc.)
4. **Constraints** — unique keys, indexes, validation
5. **Migrations** — how to evolve the schema over time

Instead of writing raw SQL `CREATE TABLE` statements, you write clean TypeScript-like syntax, then Prisma auto-generates:
- SQL migrations
- TypeScript types (100% type-safe at runtime)
- The ORM client to query data

**Example:**
```prisma
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]  // one user has many posts
}

model Post {
  id    Int     @id @default(autoincrement())
  title String
  authorId Int
  author User @relation(fields: [authorId], references: [id])
}
```

This creates two tables (`users`, `posts`) with a foreign key relationship. Prisma generates types:
```typescript
interface User {
  id: number;
  email: string;
  name: string | null;
  posts: Post[];  // populated on demand
}
```

---

# HireGene Complete Prisma Schema Design

This is the **production-ready schema** for the entire HireGene backend.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS (Enum types for specific fields)
// ═══════════════════════════════════════════════════════════════════════════════

enum JobSource {
  linkedin
  x

  @@map("job_source")
}

enum RoleFamily {
  engineering
  ai_ml
  product
  design
  data
  growth
  marketing
  content
  ops
  founders_office
  sales
  strategy
  finance
  business
  people

  @@map("role_family")
}

enum SeniorityLevel {
  intern
  junior
  mid
  senior
  lead
  staff
  head

  @@map("seniority_level")
}

enum RemoteMode {
  in_office
  remote
  hybrid

  @@map("remote_mode")
}

enum TechStack {
  python
  java
  sql
  ai
  aws
  langchain
  rag
  react
  llm
  nextjs
  typescript
  nodejs
  go
  rust
  docker

  @@map("tech_stack")
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECRUITERS MODEL
// ═══════════════════════════════════════════════════════════════════════════════

model Recruiter {
  id            Int      @id @default(autoincrement())
  
  // Profile info
  name          String
  linkedinUrl   String?  @unique @map("linkedin_url")
  xHandle       String?  @unique @map("x_handle")
  
  // Status
  active        Boolean  @default(true)
  
  // Timestamps
  addedAt       DateTime @default(now()) @map("added_at")
  lastScrapedAt DateTime? @map("last_scraped_at")
  
  // Relations
  jobs          Job[]
  apifyRuns     ApifyRunLog[]
  
  @@map("recruiters")
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOBS MODEL (The core feed)
// ═══════════════════════════════════════════════════════════════════════════════

model Job {
  id            Int      @id @default(autoincrement())
  
  // Foreign key to recruiter who posted this
  recruiterId   Int      @map("recruiter_id")
  recruiter     Recruiter @relation(fields: [recruiterId], references: [id], onDelete: Cascade)
  
  // ─── Core job fields (matches frontend Job interface) ───
  
  // Title and company
  title         String   // "Senior Backend Engineer"
  company       String   // "Razorpay"
  
  // Author (recruiter) info at time of post
  author        String   // recruiter's display name
  authorTitle   String   @map("author_title")  // "VP Engineering @ Razorpay"
  roleBadge     String   @map("role_badge")  // "Senior Backend Engineer @ Razorpay"
  
  // Source and original post
  source        JobSource              // "linkedin" or "x"
  sourceUrl     String   @unique @map("source_url")  // UNIQUE dedup key
  
  // Structured job attributes
  roleFamily    RoleFamily  @map("role_family")
  seniority     SeniorityLevel
  remoteMode    RemoteMode  @map("remote_mode")
  stack         TechStack[]             // Array of tech stack values
  
  // Post content
  description   String[]  // Array of bullet points from original post
  rawText       String    @map("raw_text")  // Original scraped text (for future LLM re-parse)
  
  // ─── Community engagement ───
  
  upvotes       Int       @default(0)
  downvotes     Int       @default(0)
  score         Int       @default(0)  // denormalized: upvotes - downvotes
  commentCount  Int       @default(0)  @map("comment_count")
  
  // ─── Lifecycle ───
  
  postedAt      DateTime  @map("posted_at")       // when original post was made
  expiresAt     DateTime  @map("expires_at")       // postedAt + 7 days
  createdAt     DateTime  @default(now()) @map("created_at")  // when we ingested it
  
  // Relations
  votes         Vote[]
  
  // Indexes for fast queries
  @@index([expiresAt])                            // Filter: expires_at > NOW()
  @@index([source, roleFamily, seniority, remoteMode])  // Filter: WHERE source = ... AND roleFamily = ...
  @@index([score(sort: Desc)])                    // Sort: ORDER BY score DESC
  @@index([postedAt(sort: Desc)])                 // Sort: ORDER BY postedAt DESC
  @@index([recruiterId])                          // Filter: WHERE recruiterId = ...
  
  @@map("jobs")
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOTES MODEL (Community ranking)
// ═══════════════════════════════════════════════════════════════════════════════

model Vote {
  id        Int      @id @default(autoincrement())
  
  // Which job
  jobId     Int      @map("job_id")
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  
  // Who voted (IP-based for MVP, will be userId later)
  voterIp   String   @map("voter_ip")  // e.g. "203.0.113.42"
  
  // Vote direction
  direction Int      // +1 for upvote, -1 for downvote
  
  // Timestamp
  createdAt DateTime @default(now()) @map("created_at")
  
  // One vote per IP per job (can't vote twice, but can change vote)
  @@unique([jobId, voterIp])
  @@map("votes")
}

// ═══════════════════════════════════════════════════════════════════════════════
// APIFY RUN LOG MODEL (Audit trail for scraping)
// ═══════════════════════════════════════════════════════════════════════════════

model ApifyRunLog {
  id            Int      @id @default(autoincrement())
  
  // Which recruiter was scraped (nullable for manual runs)
  recruiterId   Int?     @map("recruiter_id")
  recruiter     Recruiter? @relation(fields: [recruiterId], references: [id], onDelete: SetNull)
  
  // Apify run metadata
  apifyRunId    String   @unique @map("apify_run_id")  // Apify's own run ID
  actorId       String   @map("actor_id")  // "apify/linkedin-post-scraper" or "quacker/twitter-scraper"
  source        JobSource  // "linkedin" or "x"
  
  // Status and results
  status        String   // "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMED-OUT"
  postsFound    Int      @default(0) @map("posts_found")  // Total posts in dataset
  jobsCreated   Int      @default(0) @map("jobs_created")  // Posts that passed isJobPost() and were inserted
  jobsSkipped   Int      @default(0) @map("jobs_skipped")  // Posts that were duplicates or not job posts
  
  // Timestamps
  startedAt     DateTime @map("started_at")
  finishedAt    DateTime? @map("finished_at")  // null until run completes
  
  // Error handling
  errorMsg      String?  @map("error_msg")  // null if succeeded, error message if failed
  
  @@map("apify_run_logs")
}
```

---

# Schema Walkthrough by Model

## 1. **Recruiter** — The watchlist

```
recruiters
├── id (Primary Key)
├── name: "Harish Kumar"
├── linkedinUrl: "https://linkedin.com/in/harishkumar" (UNIQUE)
├── xHandle: "harishk" (UNIQUE)
├── active: true
├── addedAt: "2026-06-01T00:00:00Z"
└── lastScrapedAt: "2026-06-14T06:00:00Z"
```

**Fields:**
- `id`: Auto-incrementing primary key
- `name`: Display name (admin input)
- `linkedinUrl` / `xHandle`: Social media profiles (can have both, but at least one required by app logic)
- `active`: Soft-delete flag — set to `false` to stop scraping without deleting history
- `addedAt`: When the recruiter was added to our watchlist
- `lastScrapedAt`: Last time we successfully ran an Apify actor for this recruiter (useful for monitoring)

**Relationships:**
- One recruiter → many jobs (one-to-many)
- One recruiter → many apifyRuns (one-to-many)

---

## 2. **Job** — The feed

This is the core table. Every row is one job post scraped from a recruiter's profile.

```
jobs
├── id: 42 (Primary Key)
├── recruiterId: 5 (Foreign Key)
├── title: "Senior Backend Engineer"
├── company: "Razorpay"
├── author: "Harish Kumar"
├── authorTitle: "VP Engineering @ Razorpay"
├── roleBadge: "Senior Backend Engineer @ Razorpay"
├── source: "linkedin"
├── sourceUrl: "https://linkedin.com/feed/update/..." (UNIQUE)
├── roleFamily: "engineering"
├── seniority: "senior"
├── remoteMode: "hybrid"
├── stack: ["typescript", "node.js", "aws", "docker"]  ← Postgres array
├── description: ["Build scalable APIs", "Lead a team of 3"]
├── rawText: "[full original post text from LinkedIn]"
├── upvotes: 24
├── downvotes: 0
├── score: 24
├── commentCount: 3
├── postedAt: "2026-06-12T04:30:00Z"
├── expiresAt: "2026-06-19T04:30:00Z"  ← auto-calculated: postedAt + 7 days
└── createdAt: "2026-06-12T06:45:00Z"  ← when we ingested it
```

**Key Design Decisions:**

1. **`sourceUrl` is UNIQUE** — This is the dedup key. If Apify scrapes the same LinkedIn post twice, the second `INSERT` fails with a unique constraint violation, which the ingest handler catches and ignores.

2. **`stack` is a Postgres array** — Instead of a join table (`tech_stacks` bridge table), we store `TechStack[]` directly. Works great for up to 15 values. Simpler queries: `WHERE 'python' = ANY(stack)`.

3. **`score` is denormalized** — We could compute it from votes at query time (`SUM(direction) FROM votes WHERE job_id = ...`), but that's a subquery on every feed request. Instead, we update this column every time a vote is cast. Denormalization is faster, especially with indexes.

4. **`rawText` stores original** — Even if our regex parser misses something, we keep the original post text. Later, an LLM re-parse endpoint can use this to improve extracted fields without re-scraping.

5. **`expiresAt` is a column, not a cron delete** — We could have a cron job that `DELETE FROM jobs WHERE postedAt < NOW() - INTERVAL 7 days`, but that's risky (what if the cron fails? data is gone forever). Instead, every feed query adds `WHERE expiresAt > NOW()`, which is safe and reversible.

**Indexes:**
- `(expiresAt)` — Every feed query filters by this
- `(source, roleFamily, seniority, remoteMode)` — Compound index for complex filters
- `(score DESC)` — For "top" sort
- `(postedAt DESC)` — For "new" sort

---

## 3. **Vote** — Community ranking

```
votes
├── id: 1001
├── jobId: 42 (Foreign Key to jobs)
├── voterIp: "203.0.113.42"
├── direction: 1  (or -1 for downvote)
└── createdAt: "2026-06-14T10:22:15Z"
```

**Key Design Decisions:**

1. **`voterIp` instead of `userId`** — For MVP, we use IP-based anonymous voting. No auth needed. Later, when you add auth, replace `voterIp` with `userId`.

2. **`@@unique([jobId, voterIp])`** — This constraint means **one vote per IP per job**. Prevents double-voting. When voting twice:
   - First upvote: creates a new row with `direction = +1`
   - Second upvote (same IP, same job): `UPSERT` tries to insert, hits unique constraint, updates instead (set `direction = +1` again — no change)
   - Upvote then downvote: updates the same row to `direction = -1`
   - Upvote twice (toggle): deletes the row (app logic removes the vote)

3. **`onDelete: Cascade`** — If a job expires and is deleted, all its votes go too. Clean cascading delete.

---

## 4. **ApifyRunLog** — Scraping audit trail

```
apify_run_logs
├── id: 201
├── recruiterId: 5 (Foreign Key, nullable)
├── apifyRunId: "abc123def456" (UNIQUE)
├── actorId: "apify/linkedin-post-scraper"
├── source: "linkedin"
├── status: "SUCCEEDED"
├── postsFound: 8
├── jobsCreated: 6
├── jobsSkipped: 2
├── startedAt: "2026-06-14T06:00:00Z"
├── finishedAt: "2026-06-14T06:05:30Z"
└── errorMsg: null
```

**Why log runs?**
- Audit trail: "When was this recruiter last scraped?"
- Debugging: "Why did 2 posts get skipped?" (look at logs + check parse rules)
- Monitoring: "Is scraping working or failing consistently?"

**`recruiterId` is nullable** — Manual scrape triggers (or future batch runs) might not be tied to a single recruiter. Nullable keeps the log flexible.

---

# Enum Types Explained

Enums in Prisma create database constraints — the column can ONLY contain one of the listed values.

```prisma
enum RoleFamily {
  engineering
  ai_ml
  product
  design
  data
  // ... 15 total
}
```

This creates:
- A Postgres enum type: `CREATE TYPE role_family AS ENUM ('engineering', 'ai_ml', ...)`
- A TypeScript type: `type RoleFamily = "engineering" | "ai_ml" | ...`
- Type checking at compile time AND runtime

If you try to insert an invalid value, Prisma throws before hitting the DB:
```typescript
prisma.job.create({
  ...
  roleFamily: "invalid-role"  // ❌ TypeScript error
})
```

---

# Migration Workflow

Once you have the schema file, Prisma generates SQL migrations:

```bash
cd frontend
npx prisma migrate dev --name init
```

This:
1. Reads `prisma/schema.prisma`
2. Generates SQL `CREATE TABLE` statements
3. Creates a migration file: `prisma/migrations/20260614000000_init/migration.sql`
4. Applies it to your database
5. Regenerates `node_modules/@prisma/client` with updated types

**Later, if you modify the schema:**
```bash
# In prisma/schema.prisma, add a new field
model Job {
  ...
  newField String?
}

# Generate and apply migration
npx prisma migrate dev --name add_new_field
```

Prisma prompts you to confirm if there's data loss risk, then creates a new migration file.

---

# Database Diagram (Relationships)

```
┌─────────────┐
│ recruiters  │
├─────────────┤
│ id (PK)     │◄─────┐
│ name        │      │
│ linkedinUrl │      │ 1-to-many
│ xHandle     │      │
│ active      │      │
└─────────────┘      │
                     │
                  ┌──────────────┐
                  │    jobs      │
                  ├──────────────┤
                  │ id (PK)      │
                  │ recruiterId  │◄─┐ (FK)
                  │ title        │  │
                  │ company      │  │
                  │ source       │  │
                  │ sourceUrl    │  │
                  │ roleFamily   │  │
                  │ seniority    │  │
                  │ remoteMode   │  │
                  │ stack[]      │  │
                  │ score        │  │
                  │ postedAt     │  │
                  │ expiresAt    │  │
                  └──────────────┘  │
                      ▲             │
                      │ 1-to-many   │
                      │             │
                  ┌──────────┐      │
                  │  votes   │      │
                  ├──────────┤      │
                  │ id (PK)  │      │
                  │ jobId(FK)├──────┘
                  │ voterIp  │
                  │direction │
                  └──────────┘

┌─────────────┐
│recruiters(FK)──┐
├─────────────┤  │
│ id (PK)     │  │ 1-to-many
└─────────────┘  │
                 │
           ┌──────────────────┐
           │ apify_run_logs   │
           ├──────────────────┤
           │ id (PK)          │
           │ recruiterId (FK) │◄─┘
           │ apifyRunId       │
           │ status           │
           │ postsFound       │
           │ jobsCreated      │
           └──────────────────┘
```

---

# Key Design Decisions Recap

| Decision | Why |
|---|---|
| Postgres array for `stack` | Simpler than join table; only 15 possible values, easy to query with `ANY()` |
| Denormalized `score` column | Faster sorting/filtering; updated on every vote |
| `sourceUrl` UNIQUE | Automatic dedup; prevents scrapy duplicate posts |
| `expiresAt` column, not cron delete | Safe, reversible, works with indexes |
| IP-based voting | No auth overhead for MVP; scalable to `userId` later |
| `rawText` stored | Enables future LLM re-parse without re-scraping |
| Soft-delete `active` flag | Don't lose recruiter history; just stop scraping |
| Compound indexes `(source, roleFamily, seniority, remoteMode)` | Covers the most common filter combinations in one index |

---

# Next Steps

1. **Create the file** at `frontend/prisma/schema.prisma` (paste the schema above)
2. **Set up Supabase** — get a Postgres database, copy the connection string to `.env.local` as `DATABASE_URL`
3. **Run migration** — `npx prisma migrate dev --name init`
4. **Verify** — check Supabase dashboard to see the tables created
5. **Generate client** — `npx prisma generate` (auto-done after migrate, but useful to know)

Then we build the API routes!
