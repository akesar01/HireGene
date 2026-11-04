// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/data";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("./UpvoteButton", () => ({ default: () => <button type="button">Upvote this job</button> }));
vi.mock("./MessageButton", () => ({ default: () => <button type="button">Draft DM</button> }));
vi.mock("./ConnectNoteButton", () => ({ default: () => <button type="button">Connection note</button> }));
vi.mock("./AppliedButton", () => ({ default: () => <button type="button">Applied</button> }));

import JobCard from "./JobCard";

const job: Job = {
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
  comments: 0,
  score: 3,
  postedAt: "2026-11-02T10:00:00.000Z",
};

function render() {
  const html = renderToStaticMarkup(<JobCard job={job} matchScore={80} matchReason="Go, backend" />);
  return new DOMParser().parseFromString(html, "text/html");
}

describe("JobCard", () => {
  it("is one link to the job page, named by the job title", () => {
    const doc = render();
    const jobLinks = [...doc.querySelectorAll("a")].filter((a) => a.getAttribute("href")?.startsWith("/jobs/"));
    expect(jobLinks).toHaveLength(1);
    expect(jobLinks[0].getAttribute("href")).toBe("/jobs/senior-backend-engineer-razorpay-bengaluru-42");
    expect(jobLinks[0].textContent).toBe("Senior Backend Engineer");
  });

  it("keeps the original post link and every control outside the job link", () => {
    const doc = render();
    const original = doc.querySelector('a[href="https://www.linkedin.com/posts/harish-hiring"]');
    expect(original?.getAttribute("target")).toBe("_blank");
    expect(original?.closest('a[href^="/jobs/"]')).toBeNull();
    const buttons = [...doc.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons).toEqual(["Upvote this job", "Draft DM", "Connection note", "Applied"]);
    for (const button of doc.querySelectorAll("button")) expect(button.closest("a")).toBeNull();
  });
});
