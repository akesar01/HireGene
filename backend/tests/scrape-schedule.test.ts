import { describe, expect, it } from "vitest";
import {
  hasBudgetForAnotherScrape,
  isRecruiterDue,
  parseExcludeIds,
  pickDueRecruiter,
  type RecruiterSchedule,
} from "../src/lib/scrape-schedule";

function recruiter(
  overrides: Partial<RecruiterSchedule> & Pick<RecruiterSchedule, "id">,
): RecruiterSchedule {
  return {
    name: `Recruiter ${overrides.id}`,
    linkedinUrl: `https://linkedin.com/in/${overrides.id}`,
    active: true,
    scrapeIntervalHours: 24,
    lastScrapedAt: null,
    ...overrides,
  };
}

describe("isRecruiterDue", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  it("treats never-scraped active recruiters as due", () => {
    expect(isRecruiterDue(recruiter({ id: 1, lastScrapedAt: null }), now)).toBe(true);
  });

  it("treats recruiters scraped inside the interval as not due", () => {
    expect(
      isRecruiterDue(
        recruiter({ id: 1, lastScrapedAt: new Date("2026-08-15T06:00:00.000Z") }),
        now,
      ),
    ).toBe(false);
  });

  it("treats recruiters scraped at or past the interval as due", () => {
    expect(
      isRecruiterDue(
        recruiter({ id: 1, lastScrapedAt: new Date("2026-08-14T12:00:00.000Z") }),
        now,
      ),
    ).toBe(true);
  });

  it("ignores inactive recruiters even if never scraped", () => {
    expect(isRecruiterDue(recruiter({ id: 1, active: false }), now)).toBe(false);
  });
});

describe("parseExcludeIds", () => {
  it("parses unique positive integers", () => {
    expect(parseExcludeIds("3, 7,3,abc,-1,0,12")).toEqual([3, 7, 12]);
  });

  it("returns an empty list for missing input", () => {
    expect(parseExcludeIds(undefined)).toEqual([]);
    expect(parseExcludeIds("")).toEqual([]);
  });
});

describe("pickDueRecruiter", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  it("picks the never-scraped recruiter before a stale one", () => {
    const { picked, dueCount } = pickDueRecruiter(
      [
        recruiter({ id: 2, lastScrapedAt: new Date("2026-08-13T12:00:00.000Z") }),
        recruiter({ id: 1, lastScrapedAt: null }),
      ],
      [],
      now,
    );

    expect(dueCount).toBe(2);
    expect(picked?.id).toBe(1);
  });

  it("skips excluded recruiters and reports remaining due count", () => {
    const { picked, dueCount } = pickDueRecruiter(
      [
        recruiter({ id: 1, lastScrapedAt: null }),
        recruiter({ id: 2, lastScrapedAt: new Date("2026-08-01T00:00:00.000Z") }),
        recruiter({ id: 3, lastScrapedAt: new Date("2026-08-15T11:00:00.000Z") }),
      ],
      [1],
      now,
    );

    expect(dueCount).toBe(1);
    expect(picked?.id).toBe(2);
  });

  it("returns null when nobody is due", () => {
    const { picked, dueCount } = pickDueRecruiter(
      [recruiter({ id: 1, lastScrapedAt: new Date("2026-08-15T11:00:00.000Z") })],
      [],
      now,
    );

    expect(dueCount).toBe(0);
    expect(picked).toBeNull();
  });
});

describe("hasBudgetForAnotherScrape", () => {
  it("stops when remaining time is below the reserve", () => {
    expect(hasBudgetForAnotherScrape(0, 90_000, 80_000, 15_000)).toBe(false);
  });

  it("continues when remaining time is above the reserve", () => {
    expect(hasBudgetForAnotherScrape(0, 90_000, 10_000, 15_000)).toBe(true);
  });
});
