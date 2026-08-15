import { describe, expect, it } from "vitest";
import {
  CONNECT_NOTE_MAX,
  extractPostHooks,
  fallbackDraft,
  firstName,
  inferProfileUrl,
  looksGeneric,
  parseOutreachResponse,
  pickProofPoints,
  profileHasOutreachContext,
  resolveOpenUrl,
  sanitizeDraft,
  type OutreachJob,
  type OutreachProfile,
} from "../src/lib/outreach-draft";

const profile: OutreachProfile = {
  contact: { name: "Ankit Sharma", location: "Bengaluru" },
  filterSummary: {
    currentTitle: "Backend engineer",
    roleFamily: "engineering",
    seniority: "mid",
    stack: ["java", "aws"],
  },
  skills: {
    languages: ["Java", "Python"],
    frameworks: ["Spring"],
    tools: ["AWS"],
  },
  experience: [
    {
      title: "SDE",
      company: "Acme",
      bullets: [
        "Built Kafka consumers that processed 2M events/day on AWS",
        "Mentored two interns on Spring Boot services",
      ],
    },
  ],
  education: [{ degree: "B.Tech CSE", institution: "NIT" }],
};

const job: OutreachJob = {
  title: "Senior Backend Engineer",
  company: "Salesforce",
  author: "Vamsi Karuturi",
  authorTitle: "Senior Backend Engineer @ Salesforce",
  source: "linkedin",
  sourceUrl: "https://www.linkedin.com/posts/vamsi-karuturi_were-hiring-activity-123",
  roleFamily: "engineering",
  seniority: "senior",
  remoteMode: "hybrid",
  stack: ["java", "aws"],
  description: ["My team is hiring a Senior Backend Engineer for Hyderabad."],
};

describe("firstName", () => {
  it("returns the first token", () => {
    expect(firstName("Vamsi Karuturi")).toBe("Vamsi");
  });

  it("skips honorifics", () => {
    expect(firstName("Dr. Priya Nair")).toBe("Priya");
  });

  it("falls back when empty", () => {
    expect(firstName("   ")).toBe("there");
  });
});

describe("inferProfileUrl", () => {
  it("extracts a LinkedIn vanity from a posts URL", () => {
    expect(inferProfileUrl(job.sourceUrl)).toBe("https://www.linkedin.com/in/vamsi-karuturi");
  });

  it("keeps an /in/ URL", () => {
    expect(inferProfileUrl("https://www.linkedin.com/in/jane-doe")).toBe(
      "https://www.linkedin.com/in/jane-doe",
    );
  });

  it("extracts an X handle from a status URL", () => {
    expect(inferProfileUrl("https://x.com/levelsio/status/123")).toBe("https://x.com/levelsio");
  });

  it("returns null for a LinkedIn feed URN with no vanity", () => {
    expect(inferProfileUrl("https://www.linkedin.com/feed/update/urn:li:activity:1")).toBeNull();
  });
});

describe("resolveOpenUrl", () => {
  it("prefers the recruiter profile URL", () => {
    expect(
      resolveOpenUrl({ ...job, authorProfileUrl: "https://www.linkedin.com/in/vamsi" }),
    ).toBe("https://www.linkedin.com/in/vamsi");
  });

  it("falls back to inferring from the post URL", () => {
    expect(resolveOpenUrl(job)).toBe("https://www.linkedin.com/in/vamsi-karuturi");
  });
});

describe("profileHasOutreachContext", () => {
  it("is true when a name and experience exist", () => {
    expect(profileHasOutreachContext(profile)).toBe(true);
  });

  it("is false for an empty profile", () => {
    expect(
      profileHasOutreachContext({
        contact: { name: "" },
        filterSummary: { currentTitle: "", roleFamily: "", seniority: "", stack: [] },
        skills: { languages: [], frameworks: [], tools: [] },
        experience: [],
        education: [],
      }),
    ).toBe(false);
  });
});

describe("pickProofPoints", () => {
  it("prefers bullets that mention the job stack", () => {
    const points = pickProofPoints(profile, job, 1);
    expect(points[0]).toMatch(/AWS|Kafka/i);
  });
});

describe("extractPostHooks", () => {
  it("pulls location and title from the post", () => {
    const hooks = extractPostHooks(job);
    expect(hooks.join(" ")).toMatch(/Hyderabad|Senior Backend Engineer|Salesforce/i);
  });
});

describe("looksGeneric", () => {
  it("flags template openers", () => {
    expect(looksGeneric("Hi Vamsi, I saw your post about the role.")).toBe(true);
    expect(looksGeneric("Hi Uzma - 2M Kafka events/day on Java/Spring, same stack as your Walmart SSE post. Ok to connect?")).toBe(true);
    expect(
      looksGeneric(
        "Hi Uzma, I work on Java and Kafka. You posted the Senior Software Engineer role at Walmart. Happy to connect.",
      ),
    ).toBe(false);
  });
});

describe("fallbackDraft", () => {
  it("returns two first-contact DMs and a connect note with resume link", () => {
    const url = "https://skiptheboard.in/r/testslug";
    const draft = fallbackDraft(profile, job, url);
    expect(draft.options.map((o) => o.id)).toEqual(["warm", "role"]);
    expect(draft.message).toContain("Vamsi");
    expect(draft.message).toContain("Salesforce");
    expect(draft.message).toContain(url);
    expect(looksGeneric(draft.message)).toBe(false);
    expect(draft.connectNote).toMatch(/I work on/i);
    expect(draft.connectNote).toMatch(/Senior Backend Engineer/);
    expect(draft.connectNote).toContain(url);
    expect(draft.connectNote).not.toMatch(/SSE post|same stack as your/i);
    expect(draft.connectNote.length).toBeLessThanOrEqual(CONNECT_NOTE_MAX);
  });
});

describe("sanitizeDraft", () => {
  it("strips wrapping quotes, em dashes, and oversize notes but keeps bullets", () => {
    const draft = sanitizeDraft({
      message: `"Hello — world\n- shipped Kafka"`,
      connectNote: "x".repeat(400),
      options: [],
    });
    expect(draft.message).toContain("Hello - world");
    expect(draft.message).toContain("- shipped Kafka");
    expect(draft.connectNote.length).toBeLessThanOrEqual(CONNECT_NOTE_MAX);
    expect(draft.connectNote.endsWith("…")).toBe(true);
  });
});

describe("parseOutreachResponse", () => {
  it("reads two DM options plus a separate connect note", () => {
    const draft = parseOutreachResponse(
      JSON.stringify({
        options: [
          {
            id: "warm",
            label: "Warm intro",
            why: "First contact",
            message: "Hi Vamsi, you posted the Senior Backend Engineer role at Salesforce. I work on Java.",
          },
          {
            id: "role",
            label: "Role mention",
            why: "Names the opening",
            message: "Hi Vamsi, the Senior Backend Engineer opening at Salesforce is in my lane.",
          },
        ],
        connectNote: "Hi Vamsi, I work on Java. You posted Senior Backend Engineer at Salesforce. Happy to connect.",
      }),
    );
    expect(draft?.options.map((o) => o.id)).toEqual(["warm", "role"]);
    expect(draft?.connectNote).toContain("Vamsi");
    expect(draft?.connectNote.length).toBeLessThanOrEqual(CONNECT_NOTE_MAX);
  });

  it("still reads a legacy single-message payload", () => {
    const draft = parseOutreachResponse(
      JSON.stringify({
        message: "Hi Vamsi, I saw your Senior Backend Engineer post at Salesforce.",
        connectNote: "Hi Vamsi, saw your Salesforce backend post.",
      }),
    );
    expect(draft?.message).toContain("Salesforce");
    expect(draft?.options.length).toBeGreaterThanOrEqual(1);
  });

  it("returns null when message is missing", () => {
    expect(parseOutreachResponse(JSON.stringify({ connectNote: "hi" }))).toBeNull();
  });
});
