// ─── Types ────────────────────────────────────────────────────────────────────

export type Source = "linkedin" | "x";
export type SortOption = "hot" | "new" | "top";
export type SourceFilter = "all" | Source;

export type RoleFamily = (typeof ROLE_FAMILIES)[number];
export type Seniority = (typeof SENIORITY_LEVELS)[number];
export type RemoteMode = (typeof REMOTE_MODES)[number];
export type TechStack = (typeof TECH_STACKS)[number];

export interface Job {
  id: number;
  title: string;
  company: string;
  author: string;
  authorTitle: string;
  authorAvatar?: string | null;
  roleBadge: string;
  source: Source;
  sourceUrl: string;
  roleFamily: RoleFamily;
  seniority: Seniority;
  remoteMode: RemoteMode;
  stack: TechStack[];
  description: string[];
  comments: number;
  score: number;
  postedAt: string;
}

export interface FilterParams {
  source: SourceFilter;
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  stack: string;
  company: string;
}

export interface TagCount {
  value: string;
  count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const ROLE_FAMILIES = [
  "engineering",
  "ai-ml",
  "product",
  "design",
  "data",
  "growth",
  "marketing",
  "content",
  "ops",
  "founders-office",
  "sales",
  "strategy",
  "finance",
  "business",
  "people",
] as const;

export const SENIORITY_LEVELS = [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "staff",
  "head",
] as const;

export const REMOTE_MODES = ["in-office", "remote", "hybrid"] as const;

export const TECH_STACKS = [
  "python",
  "java",
  "sql",
  "ai",
  "aws",
  "langchain",
  "rag",
  "react",
  "llm",
  "next.js",
  "typescript",
  "node.js",
  "go",
  "rust",
  "docker",
] as const;

export const SORT_OPTIONS: SortOption[] = ["hot", "new", "top"];
export const SOURCE_OPTIONS: SourceFilter[] = ["all", "linkedin", "x"];

const HOURS_MS = 3_600_000;
const DAYS_MS = 86_400_000;

// Mock jobs
export const jobs: Job[] = [
  {
    id: 1,
    title: "Software Engineer - Database Internals",
    company: "Google",
    author: "Shivam Shrivastava",
    authorTitle: "SWE-ML@ Google | Microsoft | IIT KGP • Kaggle & Codeforces Expert",
    roleBadge: "Software Engineer - Database Internals @ Google",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example1",
    roleFamily: "engineering",
    seniority: "mid",
    remoteMode: "in-office",
    stack: ["python", "ai"],
    description: [
      "2+ years of experience with database internals and AI algorithms",
      "Strong C/C++ development skills",
      "Experience with RDBMS kernels or storage engines...",
    ],
    comments: 1, score: 1,
    postedAt: "2026-06-11T10:00:00Z",
  },
  {
    id: 2,
    title: "We're Hiring | SMTS | Salesforce | Hyderabad",
    company: "Salesforce",
    author: "Vamsi Karuturi",
    authorTitle: "Senior Backend Engineer @ Salesforce | Kafka · Distributed Systems · Java · AWS",
    roleBadge: "Senior Member of Technical Staff @ Salesforce",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example2",
    roleFamily: "engineering",
    seniority: "senior",
    remoteMode: "in-office",
    stack: ["java", "aws"],
    description: [
      "My team at Salesforce is actively looking for Senior Member of Technical Staff (SMTS) engineers for our Hyderabad office.",
      "What we're looking for:",
    ],
    comments: 1, score: 1,
    postedAt: "2026-06-11T08:00:00Z",
  },
  {
    id: 3,
    title: "Senior Backend Engineer — Node.js & Microservices",
    company: "Biizline",
    author: "Mohit Patel",
    authorTitle: "Founder, Biizline® | B2B Order Management Platform for Indian MSMEs",
    roleBadge: "Senior Backend Engineer @ Biizline",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example3",
    roleFamily: "engineering",
    seniority: "senior",
    remoteMode: "in-office",
    stack: ["node.js", "typescript", "docker", "aws"],
    description: [
      "We are looking for a Senior Node.js Backend Developer",
      "Helping FMCG, Plastics, Hardware & Electrical Distributors replace WhatsApp + Register + Excel",
    ],
    comments: 0, score: 0,
    postedAt: "2026-06-11T06:00:00Z",
  },
  {
    id: 4,
    title: "Founding Engineer — Full Stack",
    company: "Stealth Startup",
    author: "Vikram Joshi",
    authorTitle: "Co-Founder & CTO | Ex-Stripe, Ex-Google",
    roleBadge: "Founding Engineer @ Stealth",
    source: "x",
    sourceUrl: "https://x.com/example4",
    roleFamily: "engineering",
    seniority: "lead",
    remoteMode: "remote",
    stack: ["react", "typescript", "go", "aws"],
    description: [
      "Building something big in fintech. Need a 0→1 generalist who can own the stack.",
      "Strong systems thinking, can ship fast, and has startup DNA.",
    ],
    comments: 5, score: 5,
    postedAt: "2026-06-12T06:00:00Z",
  },
  {
    id: 5,
    title: "Product Design Lead",
    company: "Swiggy",
    author: "Neha Gupta",
    authorTitle: "Design Director @ Swiggy | Ex-Flipkart",
    roleBadge: "Product Design Lead @ Swiggy",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example5",
    roleFamily: "design",
    seniority: "lead",
    remoteMode: "in-office",
    stack: [],
    description: [
      "Looking for a Design Lead to own the consumer experience for our food delivery product.",
      "5+ years in product design, strong systems thinking.",
    ],
    comments: 2, score: 2,
    postedAt: "2026-06-11T14:00:00Z",
  },
  {
    id: 6,
    title: "Data Analyst Intern — Remote",
    company: "Meesho",
    author: "Swechha Jha",
    authorTitle: "Data Lead @ Meesho",
    roleBadge: "Data Analyst Intern @ Meesho",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example6",
    roleFamily: "data",
    seniority: "intern",
    remoteMode: "remote",
    stack: ["python", "sql"],
    description: [
      "Hiring data analyst interns. Must know SQL and Python.",
      "Bonus: experience with dashboarding tools (Metabase, Looker).",
    ],
    comments: 3, score: 3,
    postedAt: "2026-06-11T10:00:00Z",
  },
  {
    id: 7,
    title: "Growth Marketing Manager",
    company: "Zepto",
    author: "Ravi Menon",
    authorTitle: "Head of Growth @ Zepto",
    roleBadge: "Growth Marketing Manager @ Zepto",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example7",
    roleFamily: "growth",
    seniority: "mid",
    remoteMode: "in-office",
    stack: [],
    description: [
      "Own CAC optimization and paid acquisition across Google, Meta, and programmatic.",
      "3+ years in performance marketing at a consumer startup.",
    ],
    comments: 0, score: 0,
    postedAt: "2026-06-10T20:00:00Z",
  },
  {
    id: 8,
    title: "Backend Engineer — Java / Spring Boot",
    company: "PhonePe",
    author: "Ankit Verma",
    authorTitle: "Engineering Manager @ PhonePe",
    roleBadge: "Backend Engineer @ PhonePe",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example8",
    roleFamily: "engineering",
    seniority: "junior",
    remoteMode: "in-office",
    stack: ["java", "aws", "docker"],
    description: [
      "Looking for backend engineers to join our payments team.",
      "Strong Java fundamentals. Experience with distributed systems is a plus.",
    ],
    comments: 2, score: 2,
    postedAt: "2026-06-11T22:00:00Z",
  },
  {
    id: 9,
    title: "ML Engineer — LLM Infrastructure",
    company: "Flipkart",
    author: "Priya Sharma",
    authorTitle: "Head of AI/ML @ Flipkart",
    roleBadge: "ML Engineer @ Flipkart",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example9",
    roleFamily: "ai-ml",
    seniority: "mid",
    remoteMode: "in-office",
    stack: ["python", "llm", "langchain", "aws"],
    description: [
      "Building LLM-powered search and recommendation systems at scale.",
      "Experience with transformer architectures and vector databases required.",
    ],
    comments: 4, score: 4,
    postedAt: "2026-06-12T02:00:00Z",
  },
  {
    id: 10,
    title: "RAG Platform Engineer",
    company: "Turing",
    author: "Deepak Singh",
    authorTitle: "CTO @ Turing",
    roleBadge: "RAG Platform Engineer @ Turing",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example10",
    roleFamily: "ai-ml",
    seniority: "senior",
    remoteMode: "remote",
    stack: ["python", "rag", "langchain", "llm", "ai"],
    description: [
      "Own our RAG pipeline end-to-end. Chunking, embedding, retrieval, re-ranking.",
      "Must have production RAG experience. Not just tutorials.",
    ],
    comments: 3, score: 3,
    postedAt: "2026-06-12T01:00:00Z",
  },
  {
    id: 11,
    title: "Full Stack Developer — React + Node",
    company: "Zomato",
    author: "Karan Malhotra",
    authorTitle: "VP Product & Engineering @ Zomato",
    roleBadge: "Full Stack Developer @ Zomato",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example11",
    roleFamily: "engineering",
    seniority: "mid",
    remoteMode: "hybrid",
    stack: ["react", "node.js", "typescript", "next.js"],
    description: [
      "Join the team building Zomato's merchant-facing products.",
      "React + Node.js. We move fast and ship weekly.",
    ],
    comments: 1, score: 1,
    postedAt: "2026-06-11T16:00:00Z",
  },
  {
    id: 12,
    title: "Product Manager — Payments",
    company: "CRED",
    author: "Aditya Rao",
    authorTitle: "Founder @ CRED",
    roleBadge: "Product Manager @ CRED",
    source: "x",
    sourceUrl: "https://x.com/example12",
    roleFamily: "product",
    seniority: "senior",
    remoteMode: "in-office",
    stack: [],
    description: [
      "Looking for a PM to own the payments experience.",
      "You should obsess over UX details and understand money movement.",
    ],
    comments: 2, score: 2,
    postedAt: "2026-06-11T18:00:00Z",
  },
  {
    id: 13,
    title: "Chief of Staff — Founder's Office",
    company: "Lenskart",
    author: "Peyush Bansal",
    authorTitle: "CEO & Founder @ Lenskart",
    roleBadge: "Chief of Staff @ Lenskart",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example13",
    roleFamily: "founders-office",
    seniority: "staff",
    remoteMode: "in-office",
    stack: [],
    description: [
      "Work directly with me on strategic initiatives across our global expansion.",
      "MBA or consulting background preferred. Must be a doer, not just a thinker.",
    ],
    comments: 6, score: 6,
    postedAt: "2026-06-12T05:00:00Z",
  },
  {
    id: 14,
    title: "Senior Frontend Engineer — React",
    company: "Razorpay",
    author: "Harish Kumar",
    authorTitle: "VP Engineering @ Razorpay",
    roleBadge: "Senior Frontend Engineer @ Razorpay",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example14",
    roleFamily: "engineering",
    seniority: "senior",
    remoteMode: "hybrid",
    stack: ["react", "typescript", "next.js"],
    description: [
      "Building the next generation of payment dashboards.",
      "Strong React, TypeScript. Experience with design systems is a plus.",
    ],
    comments: 3, score: 3,
    postedAt: "2026-06-12T04:00:00Z",
  },
  {
    id: 15,
    title: "Content Strategist — Remote",
    company: "Notion",
    author: "Tanya Iyer",
    authorTitle: "Content Lead @ Notion",
    roleBadge: "Content Strategist @ Notion",
    source: "x",
    sourceUrl: "https://x.com/example15",
    roleFamily: "content",
    seniority: "mid",
    remoteMode: "remote",
    stack: [],
    description: [
      "Help us tell the Notion story to developers and creators in India.",
      "Strong portfolio required. Bonus if you've written for SaaS/dev tools.",
    ],
    comments: 1, score: 1,
    postedAt: "2026-06-10T12:00:00Z",
  },
  {
    id: 16,
    title: "Marketing Manager — Brand & Comms",
    company: "Nykaa",
    author: "Falguni Nayar",
    authorTitle: "Founder & CEO @ Nykaa",
    roleBadge: "Marketing Manager @ Nykaa",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example16",
    roleFamily: "marketing",
    seniority: "senior",
    remoteMode: "hybrid",
    stack: [],
    description: [
      "Own brand strategy and communications for our beauty vertical.",
      "5+ years in brand marketing. Consumer brand experience required.",
    ],
    comments: 0, score: 0,
    postedAt: "2026-06-11T09:00:00Z",
  },
  {
    id: 17,
    title: "Ops Manager — Logistics & Fulfillment",
    company: "Delhivery",
    author: "Suresh Nair",
    authorTitle: "COO @ Delhivery",
    roleBadge: "Ops Manager @ Delhivery",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example17",
    roleFamily: "ops",
    seniority: "senior",
    remoteMode: "in-office",
    stack: [],
    description: [
      "Manage last-mile delivery operations across South India.",
      "Experience with logistics tech and fleet management required.",
    ],
    comments: 0, score: 0,
    postedAt: "2026-06-10T08:00:00Z",
  },
  {
    id: 18,
    title: "Head of People & Culture",
    company: "Slice",
    author: "Rajan Bajaj",
    authorTitle: "CEO @ Slice",
    roleBadge: "Head of People @ Slice",
    source: "x",
    sourceUrl: "https://x.com/example18",
    roleFamily: "people",
    seniority: "head",
    remoteMode: "in-office",
    stack: [],
    description: [
      "Build our people function from scratch. 300+ employees, scaling to 500.",
      "You'll own hiring, culture, L&D, and employee experience.",
    ],
    comments: 1, score: 1,
    postedAt: "2026-06-10T15:00:00Z",
  },
  {
    id: 19,
    title: "Platform Engineer — DevOps & Infra",
    company: "Atlassian India",
    author: "Johannes Nagl",
    authorTitle: "Head of Engineering @ Atlassian India",
    roleBadge: "Platform Engineer @ Atlassian",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example19",
    roleFamily: "engineering",
    seniority: "senior",
    remoteMode: "remote",
    stack: ["docker", "aws", "go", "python"],
    description: [
      "Own CI/CD pipelines and infrastructure for our Bangalore team.",
      "K8s, Terraform, and strong Linux fundamentals required.",
    ],
    comments: 2, score: 2,
    postedAt: "2026-06-11T20:00:00Z",
  },
  {
    id: 20,
    title: "AI Research Intern — Computer Vision",
    company: "Google India",
    author: "Shivam Shrivastava",
    authorTitle: "Staff Research Scientist @ Google",
    roleBadge: "AI Research Intern @ Google",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example20",
    roleFamily: "ai-ml",
    seniority: "intern",
    remoteMode: "in-office",
    stack: ["python", "ai"],
    description: [
      "Research internship focusing on multi-modal models.",
      "Currently pursuing MS/PhD in CS with publications in top venues.",
    ],
    comments: 8, score: 8,
    postedAt: "2026-06-12T07:00:00Z",
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getTagCounts(jobList: Job[], field: keyof Job): TagCount[] {
  const counts: Record<string, number> = {};

  for (const job of jobList) {
    const val = job[field];
    if (Array.isArray(val)) {
      for (const v of val) {
        counts[v] = (counts[v] || 0) + 1;
      }
    } else if (typeof val === "string") {
      counts[val] = (counts[val] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([value, count]) => ({ value, count }));
}

export function sortJobs(jobList: Job[], sort: SortOption): Job[] {
  const sorted = [...jobList];

  switch (sort) {
    case "new":
      return sorted.sort(
        (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
      );

    case "top":
      return sorted.sort((a, b) => b.score - a.score);

    case "hot":
    default: {
      // hot = score first, then recency
      return sorted.sort(
        (a, b) => b.score - a.score || new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
      );
    }
  }
}

export function filterJobs(jobList: Job[], filters: FilterParams): Job[] {
  return jobList.filter((job) => {
    if (filters.source !== "all" && job.source !== filters.source) return false;
    if (filters.roleFamily && job.roleFamily !== filters.roleFamily) return false;
    if (filters.seniority && job.seniority !== filters.seniority) return false;
    if (filters.remoteMode && job.remoteMode !== filters.remoteMode) return false;
    if (filters.stack && !(job.stack as string[]).includes(filters.stack)) return false;
    if (filters.company && !job.company.toLowerCase().includes(filters.company.toLowerCase())) return false;
    return true;
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / HOURS_MS);

  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diff / DAYS_MS);
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}
