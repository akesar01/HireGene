// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobDetail } from "@/lib/data";

const { fetchJobDetail } = vi.hoisted(() => ({ fetchJobDetail: vi.fn() }));

vi.mock("@/lib/api", () => ({ fetchJobDetail }));
vi.mock("@/components/Header", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  permanentRedirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT 308 ${url}`);
  },
}));

import JobPage, { generateMetadata } from "./page";

const CANONICAL = "senior-backend-engineer-razorpay-bengaluru-42";

function detail(overrides: Partial<JobDetail> = {}): JobDetail {
  const postedAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
  return {
    id: 42,
    title: "Senior Backend Engineer",
    company: "Razorpay",
    author: "Harish Kumar",
    authorTitle: "VP Engineering @ Razorpay",
    roleBadge: "Senior Backend Engineer @ Razorpay",
    source: "linkedin",
    sourceUrl: "https://www.linkedin.com/posts/harish-hiring",
    roleFamily: "engineering",
    seniority: "senior",
    remoteMode: "in-office",
    stack: ["go"],
    description: ["5+ years building payment systems"],
    locations: [{ city: "Bengaluru", region: "Karnataka", country: "IN" }],
    country: "IN",
    employmentTypes: ["FULL_TIME"],
    posterKind: "Hiring manager",
    levelLabel: "Senior / SDE-3+",
    remoteLabel: "In-office",
    comments: 0,
    score: 3,
    postedAt,
    expiresAt: new Date(Date.now() + 27 * 86_400_000).toISOString(),
    expired: false,
    ...overrides,
  };
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

async function render(slug = CANONICAL) {
  const html = renderToStaticMarkup(await JobPage(params(slug)));
  return new DOMParser().parseFromString(html, "text/html");
}

function jsonLd(doc: Document) {
  const script = doc.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.textContent ?? "") : null;
}

describe("/jobs/[slug]", () => {
  beforeEach(() => fetchJobDetail.mockResolvedValue(detail()));
  afterEach(() => fetchJobDetail.mockReset());

  it("renders the job, who posted it, the source CTA and JobPosting data", async () => {
    const doc = await render();
    expect(fetchJobDetail).toHaveBeenCalledWith(42);
    expect(doc.querySelector("h1")?.textContent).toBe("Senior Backend Engineer");
    const text = doc.body.textContent ?? "";
    for (const part of ["Razorpay", "Bengaluru", "In-office", "Senior / SDE-3+", "Full-time", "Go", "5+ years building payment systems"]) {
      expect(text).toContain(part);
    }
    expect(text).toContain("Harish · Hiring manager on LinkedIn");
    expect(text).not.toContain("Kumar");

    const cta = [...doc.querySelectorAll("a")].find((a) => a.textContent?.includes("View original post / Apply"));
    expect(cta?.getAttribute("href")).toBe("https://www.linkedin.com/posts/harish-hiring");
    expect(cta?.getAttribute("rel")).toContain("noopener");

    const ld = jsonLd(doc);
    expect(ld["@type"]).toBe("JobPosting");
    expect(ld.hiringOrganization.name).toBe("Razorpay");
  });

  it("sets a canonical URL, title, description and the site OG image", async () => {
    const meta = await generateMetadata(params(CANONICAL));
    expect(meta.alternates?.canonical).toBe(`/jobs/${CANONICAL}`);
    expect(meta.title).toBe("Senior Backend Engineer at Razorpay, Bengaluru");
    expect(meta.description).toContain("Razorpay is hiring for the role of Senior Backend Engineer in Bengaluru.");
    expect(meta.openGraph?.url).toBe(`https://skiptheboard.in/jobs/${CANONICAL}`);
    expect(JSON.stringify(meta.openGraph?.images)).toContain("/opengraph-image");
    expect(meta.robots).toBeUndefined();
  });

  it("redirects an old or mismatched slug to the canonical one", async () => {
    await expect(JobPage(params("old-title-42"))).rejects.toThrow(`NEXT_REDIRECT 308 /jobs/${CANONICAL}`);
    await expect(JobPage(params("42"))).rejects.toThrow(`NEXT_REDIRECT 308 /jobs/${CANONICAL}`);
  });

  it("404s for an unknown job or a slug without an id", async () => {
    fetchJobDetail.mockResolvedValue(null);
    await expect(JobPage(params("gone-job-7"))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(JobPage(params("no-id-here"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("drops an expired job from search: noindex and no JobPosting data", async () => {
    fetchJobDetail.mockResolvedValue(detail({ expired: true }));
    const meta = await generateMetadata(params(CANONICAL));
    expect(meta.robots).toEqual({ index: false, follow: true });
    const doc = await render();
    expect(jsonLd(doc)).toBeNull();
    expect(doc.body.textContent).toContain("This job has expired");
  });

  it("renders without structured data when the company is unknown", async () => {
    fetchJobDetail.mockResolvedValue(detail({ company: "Unknown" }));
    const doc = await render("senior-backend-engineer-bengaluru-42");
    expect(doc.querySelector("h1")?.textContent).toBe("Senior Backend Engineer");
    expect(jsonLd(doc)).toBeNull();
  });
});
