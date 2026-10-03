import { describe, expect, it } from "vitest";
import {
  ACCENT,
  cardLines,
  companiesLine,
  initials,
  momentumFor,
  postedAgo,
  renderNudgeEmail,
  renderSubject,
  usableAvatarUrl,
  type RenderInput,
  type RenderJob,
} from "../src/lib/nudge-render";

const NOW = new Date("2026-10-03T10:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const FUTURE_E = Math.floor(NOW.getTime() / 1000) + 30 * 86_400;
const PAST_E = Math.floor(NOW.getTime() / 1000) - 60;
const liUrl = (e: number) => `https://media.licdn.com/dms/image/v2/D5603AQ/profile-displayphoto/0/1700?e=${e}&v=beta&t=abc`;

const jobs: RenderJob[] = [
  {
    id: 23,
    title: "SDE 1",
    company: "M2P Fintech",
    author: "Srinivasarao Narayanasetty",
    authorAvatar: liUrl(FUTURE_E),
    posterKind: "Hiring manager",
    levelLabel: "SDE-1 level",
    remoteLabel: "In-office",
    postedAt: ago(10 * DAY),
  },
  {
    id: 91,
    title: "Software Engineer <Backend>",
    company: "Zepto",
    author: "Sthiti M",
    authorAvatar: null,
    posterKind: "Recruiter",
    levelLabel: "SDE-1 level",
    remoteLabel: "Remote",
    postedAt: ago(3 * HOUR),
  },
];

const input: RenderInput = {
  recipientName: "Ankit",
  jobs,
  sendId: "send-abc",
  campaignKey: "weekly-2026-W40",
  siteUrl: "https://skiptheboard.in",
  unsubscribeUrl: "https://skiptheboard.in/unsubscribe?t=TOKEN",
  preferencesUrl: "https://skiptheboard.in/profile?utm_source=nudge#email",
  now: NOW,
};

const job = (overrides: Partial<RenderJob> = {}): RenderJob => ({ ...jobs[0], ...overrides });

describe("subject, preheader and intro", () => {
  it("are short and personal by default", () => {
    const out = renderNudgeEmail(input);
    expect(out.subject).toBe("2 new jobs that match you");
    expect(out.preheader).toBe("Picked from posts by the people hiring");
    expect(out.html).toContain("Picked from posts by the people hiring");
    expect(out.html).toContain("Hi Ankit, 2 jobs matched your resume this week.");
    expect(out.text.split("\n")[0]).toBe("Hi Ankit, 2 jobs matched your resume this week.");
  });

  it("handles one job, no name, and daily campaigns", () => {
    const out = renderNudgeEmail({ ...input, jobs: [jobs[0]], recipientName: null, campaignKey: "daily-2026-10-03" });
    expect(out.subject).toBe("1 new job that matches you");
    expect(out.text.split("\n")[0]).toBe("Hi there, 1 job matched your resume today.");
  });

  it("says today in the dashboard preview of a daily campaign", () => {
    const daily = renderNudgeEmail({ ...input, campaignKey: "preview-daily-2026-10-03" });
    expect(daily.text.split("\n")[0]).toBe("Hi Ankit, 2 jobs matched your resume today.");
    const weekly = renderNudgeEmail({ ...input, campaignKey: "preview-weekly-2026-09-28" });
    expect(weekly.text.split("\n")[0]).toBe("Hi Ankit, 2 jobs matched your resume this week.");
  });

  it("keeps experiment subject and intro overrides working", () => {
    expect(companiesLine(jobs)).toBe("M2P Fintech, Zepto");
    expect(renderSubject({ ...input, subjectTemplate: "{name}, {count} new matches at {companies}" })).toBe(
      "Ankit, 2 new matches at M2P Fintech, Zepto",
    );
    const out = renderNudgeEmail({ ...input, intro: "Hand-picked for {name}." });
    expect(out.html).toContain("Hand-picked for Ankit.");
    expect(out.text.split("\n")[0]).toBe("Hand-picked for Ankit.");
    expect(out.html).not.toContain("matched your resume");
  });
});

describe("cards", () => {
  it("render title and company, poster first name and kind, and level, mode and age", () => {
    const { html, text } = renderNudgeEmail(input);
    expect(text).toContain(
      [
        "SDE 1 · M2P Fintech",
        "Srinivasarao · Hiring manager",
        "SDE-1 level · In-office · posted 10 days ago",
        "View post: https://skiptheboard.in/go/send-abc/23",
      ].join("\n"),
    );
    expect(html).toContain("SDE 1 · M2P Fintech");
    expect(html).toContain("Srinivasarao · Hiring manager");
    expect(html).toContain("Sthiti · Recruiter");
    expect(html).not.toContain("Narayanasetty ·");
  });

  it("drop unknown parts instead of printing placeholders", () => {
    const lines = cardLines(job({ company: "Unknown", levelLabel: "", remoteLabel: "unknown", author: "" }), undefined, NOW);
    expect(lines.title).toBe("SDE 1");
    expect(lines.poster).toBe("Hiring manager");
    expect(lines.meta).toBe("posted 10 days ago");
  });

  it("route View post through /go/<sendId>/<jobId> as a table-based button", () => {
    const { html } = renderNudgeEmail(input);
    expect(html.match(/>View post<\/a>/g)).toHaveLength(2);
    expect(html).toContain(`<td align="center" bgcolor="${ACCENT}"`);
    expect(html).toContain('href="https://skiptheboard.in/go/send-abc/23"');
    expect(html).toContain('href="https://skiptheboard.in/go/send-abc/91"');
  });

  it("no longer render bullets, stack tags, match percent, DM link, resume upsell or forward block", () => {
    const withExtras = { ...input, jobs: jobs.map((j) => ({ ...j, bullets: ["Large-scale fintech"], stack: ["python"], matchPercent: 78 })) };
    const { html, text } = renderNudgeEmail(withExtras);
    for (const out of [html, text]) {
      expect(out).not.toContain("Large-scale fintech");
      expect(out).not.toMatch(/Python/);
      expect(out).not.toMatch(/Match \d+%|78%/);
      expect(out).not.toMatch(/Draft a DM/i);
      expect(out).not.toMatch(/dm-23/);
      expect(out).not.toMatch(/Scores come from|update your resume|Update it and|utm_content=profile/i);
      expect(out).not.toMatch(/forward|friend/i);
    }
    expect(html).not.toMatch(/<ul|<li/);
  });

  it("escape HTML in job content", () => {
    const { html } = renderNudgeEmail(input);
    expect(html).toContain("Software Engineer &lt;Backend&gt;");
    expect(html).not.toContain("<Backend>");
  });

  it("render one column at most 560px wide on white with a system font stack", () => {
    const { html } = renderNudgeEmail(input);
    expect(html).toContain("max-width:560px");
    expect(html).toContain("background:#ffffff");
    expect(html).toContain("-apple-system");
    expect(html).not.toMatch(/fonts\.googleapis|Inter,/);
  });
});

describe("avatar", () => {
  it("shows a round 48px photo with alt text when the URL is usable", () => {
    const { html } = renderNudgeEmail(input);
    expect(html).toContain(
      `<img src="${liUrl(FUTURE_E).replace(/&/g, "&amp;")}" width="48" height="48" alt="Srinivasarao Narayanasetty"`,
    );
    expect(html).toContain("border-radius:24px");
  });

  it("falls back to an initials badge when the URL is missing", () => {
    const { html } = renderNudgeEmail({ ...input, jobs: [job({ authorAvatar: null })] });
    expect(html).not.toContain("<img");
    expect(html).toMatch(new RegExp(`bgcolor="${ACCENT}" aria-label="Srinivasarao Narayanasetty"[^>]*>SN</td>`));
    expect(html).toMatch(/width="48" height="48"/);
  });

  it("falls back to initials when a LinkedIn URL has expired by send time", () => {
    expect(usableAvatarUrl(liUrl(PAST_E), NOW)).toBeNull();
    expect(usableAvatarUrl(liUrl(Math.floor(NOW.getTime() / 1000)), NOW)).toBeNull();
    expect(usableAvatarUrl(liUrl(FUTURE_E), NOW)).toBe(liUrl(FUTURE_E));
    const { html } = renderNudgeEmail({ ...input, jobs: [job({ authorAvatar: liUrl(PAST_E) })] });
    expect(html).not.toContain("<img");
    expect(html).toContain(">SN</td>");
  });

  it("rejects empty, malformed and non-http URLs, and keeps non-LinkedIn URLs", () => {
    expect(usableAvatarUrl("", NOW)).toBeNull();
    expect(usableAvatarUrl("   ", NOW)).toBeNull();
    expect(usableAvatarUrl("not a url", NOW)).toBeNull();
    expect(usableAvatarUrl("javascript:alert(1)", NOW)).toBeNull();
    expect(usableAvatarUrl("https://media.licdn.com/x.jpg?e=soon", NOW)).toBeNull();
    expect(usableAvatarUrl("https://pbs.twimg.com/profile_images/1/a.jpg", NOW)).toBe("https://pbs.twimg.com/profile_images/1/a.jpg");
  });

  it("builds initials from first and last name", () => {
    expect(initials("Srinivasarao Narayanasetty")).toBe("SN");
    expect(initials("sthiti")).toBe("S");
    expect(initials("Anna-Maria (Hiring) Lee")).toBe("AL");
    expect(initials("")).toBe("?");
  });
});

describe("momentum line", () => {
  const old = job({ postedAt: ago(10 * DAY) });

  it("prefers applications at 3 or more", () => {
    expect(momentumFor(old, { applied: 3, viewers: 50 }, NOW)?.text).toBe("3 people applied via SkipTheBoard");
    expect(momentumFor(old, { applied: 2, viewers: 0 }, NOW)).toBeNull();
  });

  it("then views at 5 or more, printed exactly", () => {
    expect(momentumFor(old, { applied: 2, viewers: 5 }, NOW)?.text).toBe("5 people viewed this");
    expect(momentumFor(old, { applied: 0, viewers: 17 }, NOW)?.text).toBe("17 people viewed this");
    expect(momentumFor(old, { applied: 0, viewers: 4 }, NOW)).toBeNull();
  });

  it("then posted under 24 hours ago", () => {
    expect(momentumFor(job({ postedAt: ago(23 * HOUR + 59 * 60_000) }), undefined, NOW)?.text).toBe(
      "Posted today, early applicants get noticed",
    );
    expect(momentumFor(job({ postedAt: ago(DAY) }), undefined, NOW)).toBeNull();
  });

  it("then posted 2 to 6 days ago", () => {
    expect(momentumFor(job({ postedAt: ago(DAY + 23 * HOUR) }), undefined, NOW)).toBeNull();
    expect(momentumFor(job({ postedAt: ago(2 * DAY) }), undefined, NOW)?.text).toBe("Posted 2 days ago, apply before it fills up");
    expect(momentumFor(job({ postedAt: ago(6 * DAY + 23 * HOUR) }), undefined, NOW)?.text).toBe(
      "Posted 6 days ago, apply before it fills up",
    );
    expect(momentumFor(job({ postedAt: ago(7 * DAY) }), undefined, NOW)).toBeNull();
  });

  it("renders at most one accent line per card, and none when no rule applies", () => {
    const signals = new Map([[23, { applied: 4, viewers: 9 }]]);
    const { html, text } = renderNudgeEmail({ ...input, signals });
    expect(text).toContain("4 people applied via SkipTheBoard");
    expect(text).not.toContain("people viewed this");
    expect(text).toContain("Posted today, early applicants get noticed");
    expect(html.match(new RegExp(`font-weight:600;color:${ACCENT};`, "g"))).toHaveLength(2);

    const quiet = renderNudgeEmail({ ...input, jobs: [old] });
    expect(quiet.html).not.toContain(`font-weight:600;color:${ACCENT};`);
    expect(quiet.text).not.toMatch(/applied via|viewed this|early applicants|fills up/);
  });

  it("does not repeat the posting age in the meta line when the momentum line states it", () => {
    const lines = cardLines(job({ postedAt: ago(3 * DAY) }), undefined, NOW);
    expect(lines.meta).toBe("SDE-1 level · In-office");
    expect(lines.momentum).toBe("Posted 3 days ago, apply before it fills up");
    expect(postedAgo(ago(3 * HOUR), NOW)).toBe("posted today");
    expect(postedAgo(ago(DAY + HOUR), NOW)).toBe("posted 1 day ago");
  });
});

describe("feed link and footer", () => {
  it("has one feed link with UTM tags and a one-line footer with unsubscribe and settings", () => {
    const { html, text } = renderNudgeEmail(input);
    expect(html.match(/See all jobs on SkipTheBoard/g)).toHaveLength(1);
    expect(html).toContain("utm_source=nudge&amp;utm_medium=email&amp;utm_campaign=weekly-2026-W40&amp;utm_content=feed");
    expect(html).toContain('href="https://skiptheboard.in/unsubscribe?t=TOKEN"');
    expect(html).toContain(">Unsubscribe</a>");
    expect(html).toContain(">Email settings</a>");
    expect(html).toContain("You get this because you uploaded your resume to SkipTheBoard.");
    expect(text).toContain("Unsubscribe: https://skiptheboard.in/unsubscribe?t=TOKEN");
    expect(text).toContain("Email settings: https://skiptheboard.in/profile?utm_source=nudge#email");
  });

  it("renders an inert footer with no unsubscribe link for test sends", () => {
    const { html, text } = renderNudgeEmail({ ...input, unsubscribeUrl: null });
    for (const out of [html, text]) {
      expect(out).toContain("unsubscribe disabled in test sends");
      expect(out).not.toContain("/unsubscribe");
    }
    expect(html).toContain("Email settings");
  });
});
