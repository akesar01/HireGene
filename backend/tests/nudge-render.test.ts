import { describe, expect, it } from "vitest";
import { companiesLine, formatPostedDate, renderNudgeEmail, renderSubject, type RenderJob } from "../src/lib/nudge-render";

const jobs: RenderJob[] = [
  {
    id: 23,
    title: "SDE 1",
    company: "M2P Fintech",
    author: "Srinivasarao Narayanasetty",
    posterKind: "Hiring manager",
    posterLine: "Engineering Manager at M2P",
    levelLabel: "SDE-1 level",
    remoteLabel: "In-office",
    stack: ["python", "nodejs", "java"],
    postedAt: new Date("2026-09-23T10:00:00Z"),
    bullets: ["Fast-paced fintech environment where work ships and scales", "Large-scale fintech products <used> by millions"],
    matchPercent: 78,
  },
  {
    id: 91,
    title: "Software Engineer",
    company: "Zepto",
    author: "Sthiti M",
    posterKind: "Recruiter",
    posterLine: "Talent Acquisition @Zepto",
    levelLabel: "SDE-1 level",
    remoteLabel: "In-office",
    stack: [],
    postedAt: new Date("2026-09-28T10:00:00Z"),
    bullets: ["1-3 years of experience as an SDE."],
    matchPercent: 60,
  },
];

const input = {
  recipientName: "Ankit",
  jobs,
  sendId: "send-abc",
  campaignKey: "weekly-2026-W40",
  siteUrl: "https://skiptheboard.in",
  unsubscribeUrl: "https://skiptheboard.in/unsubscribe?t=TOKEN",
  preferencesUrl: "https://skiptheboard.in/profile#email",
};

describe("renderNudgeEmail", () => {
  it("builds the default subject from count and companies", () => {
    expect(companiesLine(jobs)).toBe("M2P Fintech, Zepto");
    expect(renderSubject(input)).toBe("2 jobs that match your resume: M2P Fintech, Zepto");
    expect(renderSubject({ ...input, subjectTemplate: "{name}, {count} new matches" })).toBe("Ankit, 2 new matches");
  });

  it("shows every required field for each job", () => {
    const { html, text } = renderNudgeEmail(input);
    for (const out of [html, text]) {
      expect(out).toContain("SDE 1");
      expect(out).toContain("M2P Fintech");
      expect(out).toContain("Srinivasarao Narayanasetty");
      expect(out).toContain("Hiring manager");
      expect(out).toContain("Recruiter");
      expect(out).toContain("SDE-1 level");
      expect(out).toContain("In-office");
      expect(out).toContain("Posted 23 Sep");
      expect(out).toContain("Posted 28 Sep");
      expect(out).toContain("Python, Node.js, Java");
      expect(out).toContain("Match 78%");
      expect(out).toContain("Match 60%");
      expect(out).toContain("Fast-paced fintech environment");
      expect(out).toContain("1-3 years of experience as an SDE.");
    }
  });

  it("routes job links through /go/<sendId>/<jobId> and tags site links with UTM", () => {
    const { html, text } = renderNudgeEmail(input);
    expect(html).toContain("https://skiptheboard.in/go/send-abc/23");
    expect(text).toContain("https://skiptheboard.in/go/send-abc/91");
    expect(html).toContain("utm_source=nudge");
    expect(html).toContain("utm_medium=email");
    expect(html).toContain("utm_campaign=weekly-2026-W40");
    expect(html).toContain("https://skiptheboard.in/unsubscribe?t=TOKEN");
    expect(text).toContain("Unsubscribe in one click: https://skiptheboard.in/unsubscribe?t=TOKEN");
  });

  it("renders an inert footer with no unsubscribe link when no unsubscribe URL is given", () => {
    const { html, text } = renderNudgeEmail({ ...input, unsubscribeUrl: null });
    for (const out of [html, text]) {
      expect(out).toContain("unsubscribe disabled in test sends");
      expect(out).not.toContain("/unsubscribe");
    }
    expect(html).toContain("https://skiptheboard.in/profile#email");
  });

  it("escapes HTML in job content and uses the variant intro", () => {
    const { html, text } = renderNudgeEmail({ ...input, intro: "Hand-picked for {name}." });
    expect(html).toContain("&lt;used&gt;");
    expect(html).not.toContain("<used>");
    expect(html).toContain("Hand-picked for Ankit.");
    expect(text).toContain("Hand-picked for Ankit.");
    expect(html).toContain("Hi Ankit,");
  });

  it("formats dates in UTC", () => {
    expect(formatPostedDate(new Date("2026-01-05T23:30:00Z"))).toBe("5 Jan");
  });
});
