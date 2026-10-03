import { JOB_EXPIRY_DAYS } from "./lib/config.js";

function buildOpenApiSpec(baseUrl: string) {
  return {
  openapi: "3.0.0",
  info: {
    title: "SkipTheBoard API",
    version: "1.0.0",
    description: "Community-driven job discovery platform. Watch real hiring managers across LinkedIn and X.",
  },
  servers: [
    { url: baseUrl, description: "Current deployment" },
  ],
  components: {
    securitySchemes: {
      AdminAuth: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: "Bearer <ADMIN_SECRET>, or a Clerk session token whose user id is in ADMIN_USER_IDS or whose primary email is in ADMIN_EMAILS",
      },
      ClerkAuth: {
        type: "http",
        scheme: "bearer",
        description: "Clerk session token",
      },
      CronAuth: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: "Bearer <CRON_SECRET> or Bearer <ADMIN_SECRET>",
      },
      ApiKey: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "API key for read endpoints",
      },
    },
    schemas: {
      Job: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          company: { type: "string" },
          author: { type: "string" },
          authorTitle: { type: "string" },
          authorAvatar: { type: "string", nullable: true },
          authorProfileUrl: { type: "string", nullable: true },
          roleBadge: { type: "string" },
          source: { type: "string", enum: ["linkedin", "x"] },
          sourceUrl: { type: "string" },
          roleFamily: { type: "string" },
          seniority: { type: "string" },
          remoteMode: { type: "string" },
          stack: { type: "array", items: { type: "string" } },
          description: { type: "array", items: { type: "string" } },
          comments: { type: "integer" },
          score: { type: "integer" },
          postedAt: { type: "string", format: "date-time" },
        },
      },
      Recruiter: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          linkedinUrl: { type: "string" },
          active: { type: "boolean" },
          scrapeIntervalHours: { type: "integer" },
          addedAt: { type: "string", format: "date-time" },
          lastScrapedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      RecruiterSubmission: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          linkedinUrl: { type: "string" },
          company: { type: "string", nullable: true },
          title: { type: "string", nullable: true },
          note: { type: "string", nullable: true },
          status: { type: "string", enum: ["pending", "approved", "rejected"] },
          recruiterId: { type: "integer", nullable: true },
          submittedAt: { type: "string", format: "date-time" },
          reviewedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      VoteResponse: {
        type: "object",
        properties: {
          score: { type: "integer" },
          voted: { type: "boolean" },
          direction: { type: "string", enum: ["up", "down"] },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/api/email/preferences": {
      get: {
        summary: "Current user's email nudge preferences",
        tags: ["Email"],
        security: [{ ClerkAuth: [] }],
        responses: { "200": { description: "Preferences (defaults when the user never changed them)" }, "401": { description: "Not signed in" } },
      },
      put: {
        summary: "Update email nudge preferences",
        tags: ["Email"],
        security: [{ ClerkAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  subscribed: { type: "boolean" },
                  frequency: { type: "string", enum: ["weekly", "daily"] },
                  pausedUntil: { type: "string", format: "date-time", nullable: true },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated preferences" } },
      },
    },
    "/api/email/unsubscribe": {
      get: {
        summary: "Redirects to the unsubscribe confirm page on the site; does not change anything",
        tags: ["Email"],
        parameters: [{ name: "t", in: "query", required: true, schema: { type: "string" }, description: "Signed token from the email footer" }],
        responses: { "302": { description: "Redirect to FRONTEND_URL/unsubscribe?t=<token>" } },
      },
      post: {
        summary: "One-click unsubscribe (signed token, no login); RFC 8058 List-Unsubscribe-Post target",
        tags: ["Email"],
        parameters: [
          { name: "t", in: "query", required: true, schema: { type: "string" }, description: "Signed token from the email footer" },
          { name: "action", in: "query", schema: { type: "string", enum: ["resubscribe"] } },
        ],
        responses: { "200": { description: "Subscription state" }, "400": { description: "Invalid token" } },
      },
    },
    "/api/email/webhook": {
      post: {
        summary: "Resend webhook (Svix-signed): delivered, opened, clicked, bounced, complained",
        tags: ["Email"],
        responses: {
          "200": { description: "Recorded (or duplicate)" },
          "400": { description: "Bad signature or body" },
          "503": { description: "RESEND_WEBHOOK_SECRET not set" },
        },
      },
    },
    "/go/{sendId}/{jobId}": {
      get: {
        summary: "Log an email click and redirect to the original post",
        tags: ["Email"],
        parameters: [
          { name: "sendId", in: "path", required: true, schema: { type: "string" } },
          { name: "jobId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: { "302": { description: "Redirect to the job's source URL, or to the feed when unknown" } },
      },
    },
    "/api/cron/nudges": {
      get: {
        summary: "Daily nudge tick: weekly campaign on Mondays, daily campaign otherwise",
        tags: ["Cron"],
        security: [{ CronAuth: [] }],
        parameters: [{ name: "campaign", in: "query", schema: { type: "integer" }, description: "Continue a specific campaign" }],
        responses: { "200": { description: "Run summary" }, "401": { description: "Unauthorized" } },
      },
      post: { summary: "Same as GET", tags: ["Cron"], security: [{ CronAuth: [] }], responses: { "200": { description: "Run summary" } } },
    },
    "/api/admin/whoami": {
      get: { summary: "Confirm admin access", tags: ["Admin"], security: [{ AdminAuth: [] }], responses: { "200": { description: "ok" }, "401": { description: "Not signed in" }, "403": { description: "Not an admin" } } },
    },
    "/api/admin/stats/subscribers": {
      get: { summary: "Subscriber counts", tags: ["Admin"], security: [{ AdminAuth: [] }], responses: { "200": { description: "Counts" } } },
    },
    "/api/admin/stats/email": {
      get: {
        summary: "Per-campaign and per-variant email performance plus top clicked jobs",
        tags: ["Admin"],
        security: [{ AdminAuth: [] }],
        parameters: [{ name: "campaignId", in: "query", schema: { type: "integer" } }],
        responses: { "200": { description: "Stats" } },
      },
    },
    "/api/admin/stats/jobs": {
      get: {
        summary: "Live jobs, jobs added per day by level and source, jobs per hiring manager, email job clicks",
        tags: ["Admin"],
        security: [{ AdminAuth: [] }],
        parameters: [{ name: "days", in: "query", schema: { type: "integer", default: 14 } }],
        responses: { "200": { description: "Stats" } },
      },
    },
    "/api/admin/nudges/users": {
      get: { summary: "Eligible recipients for the preview picker", tags: ["Admin"], security: [{ AdminAuth: [] }], parameters: [{ name: "q", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Users" } } },
    },
    "/api/admin/nudges/preview": {
      get: {
        summary: "Render a user's nudge without sending",
        tags: ["Admin"],
        security: [{ AdminAuth: [] }],
        parameters: [
          { name: "userId", in: "query", required: true, schema: { type: "string" } },
          { name: "campaignId", in: "query", schema: { type: "integer" } },
          { name: "variantId", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Subject, html, text, picks, or the skip reason" } },
      },
    },
    "/api/admin/nudges/test": {
      post: {
        summary: "Send one test email to an address (dry run without RESEND_API_KEY)",
        tags: ["Admin"],
        security: [{ AdminAuth: [] }],
        requestBody: { content: { "application/json": { schema: { type: "object", required: ["to", "userId"], properties: { to: { type: "string" }, userId: { type: "string" }, campaignId: { type: "integer" }, variantId: { type: "integer" } } } } } },
        responses: { "200": { description: "Sent or dry run" }, "422": { description: "Nothing to send" } },
      },
    },
    "/api/admin/nudges/schedule": {
      get: { summary: "Weekly schedule state", tags: ["Admin"], security: [{ AdminAuth: [] }], responses: { "200": { description: "paused flag and cron" } } },
      put: { summary: "Pause or resume the schedule", tags: ["Admin"], security: [{ AdminAuth: [] }], requestBody: { content: { "application/json": { schema: { type: "object", required: ["paused"], properties: { paused: { type: "boolean" } } } } } }, responses: { "200": { description: "paused flag" } } },
    },
    "/api/admin/nudges/campaigns": {
      get: { summary: "List campaigns", tags: ["Admin"], security: [{ AdminAuth: [] }], responses: { "200": { description: "Campaigns with variants" } } },
      post: {
        summary: "Create an experiment with 2+ variants (weights sum to 100; a holdout arm receives nothing)",
        tags: ["Admin"],
        security: [{ AdminAuth: [] }],
        requestBody: { content: { "application/json": { schema: { type: "object", required: ["name", "variants"], properties: { name: { type: "string" }, jobCount: { type: "integer" }, variants: { type: "array", items: { type: "object", properties: { key: { type: "string" }, name: { type: "string" }, weight: { type: "integer" }, isHoldout: { type: "boolean" }, subject: { type: "string", nullable: true }, intro: { type: "string", nullable: true }, jobCount: { type: "integer", nullable: true } } } } } } } } },
        responses: { "201": { description: "Created (draft)" }, "400": { description: "Invalid variants" } },
      },
    },
    "/api/admin/nudges/send-now": {
      post: {
        summary: "Run a campaign now (creates a manual campaign when none is given); continues itself past the time budget",
        tags: ["Admin"],
        security: [{ AdminAuth: [] }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { campaignId: { type: "integer" } } } } } },
        responses: { "200": { description: "Run summary" }, "404": { description: "Campaign not found" }, "409": { description: "Already completed" } },
      },
    },
    // ─── Health ───
    "/health": {
      get: {
        summary: "Health check",
        responses: { "200": { description: "OK" } },
      },
    },

    // ─── Posts ───
    "/api/posts/recent": {
      get: {
        summary: "Get filtered + sorted job feed",
        security: [{ ApiKey: [] }],
        parameters: [
          { name: "sort", in: "query", schema: { type: "string", enum: ["new", "top"] }, description: "Sort order: new (latest first, default) or top (most voted)" },
          { name: "role_family", in: "query", schema: { type: "string" } },
          { name: "seniority", in: "query", schema: { type: "string" } },
          { name: "remote_mode", in: "query", schema: { type: "string" } },
          { name: "stack", in: "query", schema: { type: "string" } },
          { name: "source", in: "query", schema: { type: "string", enum: ["linkedin", "x"] } },
        ],
        responses: {
          "200": {
            description: "List of jobs",
            content: { "application/json": { schema: { type: "object", properties: { jobs: { type: "array", items: { $ref: "#/components/schemas/Job" } }, count: { type: "integer" } } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/profile/outreach": {
      post: {
        summary: "Draft a LinkedIn or X DM from the user's resume and a job post",
        description:
          "Does not send the message. Returns two DM drafts to choose from, plus a separate 300-character LinkedIn connection-request note.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { jobId: { type: "integer" } },
                required: ["jobId"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Draft generated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    connectNote: { type: "string" },
                    options: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          label: { type: "string" },
                          why: { type: "string" },
                          message: { type: "string" },
                        },
                      },
                    },
                    authorName: { type: "string" },
                    authorTitle: { type: "string" },
                    source: { type: "string", enum: ["linkedin", "x"] },
                    sourceUrl: { type: "string" },
                    openUrl: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Authentication required" },
          "404": { description: "No resume or job not found" },
        },
      },
    },
    "/api/posts/{id}/vote": {
      post: {
        summary: "Vote on a job (up or down). IP-based dedup — one vote per IP per job.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { direction: { type: "string", enum: ["up", "down"] } }, required: ["direction"] } } },
        },
        responses: {
          "200": { description: "Vote toggled or flipped", content: { "application/json": { schema: { $ref: "#/components/schemas/VoteResponse" } } } },
          "201": { description: "New vote created", content: { "application/json": { schema: { $ref: "#/components/schemas/VoteResponse" } } } },
          "404": { description: "Job not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Recruiter Suggest (public) ───
    "/api/recruiter-suggest": {
      post: {
        summary: "Submit a hiring manager for review (human-in-the-loop)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: {
            name: { type: "string" },
            linkedinUrl: { type: "string" },
            company: { type: "string" },
            title: { type: "string" },
            note: { type: "string" },
          }, required: ["name", "linkedinUrl"] } } },
        },
        responses: {
          "201": { description: "Submission received", content: { "application/json": { schema: { type: "object", properties: { id: { type: "integer" }, status: { type: "string" }, message: { type: "string" } } } } } },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Duplicate", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Admin: Recruiters ───
    "/api/admin/recruiter": {
      post: {
        summary: "Add a recruiter directly (admin)",
        security: [{ AdminAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: {
            name: { type: "string" },
            linkedinUrl: { type: "string" },
            scrapeIntervalHours: { type: "integer" },
          }, required: ["name", "linkedinUrl"] } } },
        },
        responses: {
          "201": { description: "Recruiter created", content: { "application/json": { schema: { $ref: "#/components/schemas/Recruiter" } } } },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Already exists", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/admin/recruiters": {
      get: {
        summary: "List all recruiters",
        security: [{ AdminAuth: [] }],
        responses: {
          "200": { description: "List of recruiters", content: { "application/json": { schema: { type: "object", properties: { recruiters: { type: "array", items: { $ref: "#/components/schemas/Recruiter" } }, count: { type: "integer" } } } } } },
        },
      },
    },

    // ─── Admin: Jobs ───
    "/api/admin/jobs": {
      delete: {
        summary: "Clear jobs from the database",
        security: [{ AdminAuth: [] }],
        parameters: [
          { name: "mode", in: "query", schema: { type: "string", enum: ["expired", "all", "olderThan"] }, description: `Clear mode (default: expired — only deletes jobs past their ${JOB_EXPIRY_DAYS}-day expiry)` },
          { name: "olderThanDays", in: "query", schema: { type: "integer" }, description: `Days threshold for olderThan mode (default: ${JOB_EXPIRY_DAYS})` },
        ],
        responses: {
          "200": { description: "Jobs cleared", content: { "application/json": { schema: { type: "object", properties: { deleted: { type: "integer" }, mode: { type: "string" }, description: { type: "string" } } } } } },
        },
      },
    },

    // ─── Cron: Expire old jobs ───
    "/api/cron/expire-jobs": {
      get: {
        summary: `Delete jobs older than ${JOB_EXPIRY_DAYS} days`,
        description:
          `Permanently deletes jobs whose postedAt is older than ${JOB_EXPIRY_DAYS} days. ` +
          "Vercel Cron calls GET daily. The daily scrape also runs this once at the start of the first hop.",
        security: [{ CronAuth: [] }, { AdminAuth: [] }],
        responses: {
          "200": {
            description: "Expired jobs deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    deleted: { type: "integer" },
                    expiryDays: { type: "integer" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        summary: `Same as GET /api/cron/expire-jobs`,
        security: [{ CronAuth: [] }, { AdminAuth: [] }],
        responses: {
          "200": { description: "Expired jobs deleted" },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Cron: Daily due scrape ───
    "/api/cron/scrape": {
      get: {
        summary: "Scrape the next due recruiter, then continue the rest in the background",
        description:
          "Starts Apify runs for all due recruiters (active, lastScrapedAt older than scrapeIntervalHours). " +
          "Does not wait 60s per person: in-flight runs are stored and ingested when Apify SUCCEEDED. " +
          "Also drains previously started runs. Remaining in-flight work is picked up on the next 15-minute cron tick.",
        security: [{ CronAuth: [] }, { AdminAuth: [] }],
        parameters: [
          { name: "once", in: "query", schema: { type: "string", enum: ["1", "true"] }, description: "Scrape only one due recruiter" },
        ],
        responses: {
          "200": { description: "Due recruiters processed up to the time budget, or none due" },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        summary: "Same as GET /api/cron/scrape",
        security: [{ CronAuth: [] }, { AdminAuth: [] }],
        parameters: [
          { name: "once", in: "query", schema: { type: "string", enum: ["1", "true"] }, description: "Scrape only one due recruiter" },
        ],
        responses: {
          "200": { description: "Due recruiters processed up to the time budget, or none due" },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Admin: Scrape ───
    "/api/admin/scrape": {
      post: {
        summary: "Trigger manual scrape for a recruiter",
        security: [{ AdminAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { recruiterId: { type: "integer" } }, required: ["recruiterId"] } } },
        },
        responses: {
          "200": { description: "Scrape result" },
          "404": { description: "Recruiter not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "500": { description: "Scrape failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Admin: Submissions ───
    "/api/admin/submissions": {
      get: {
        summary: "List recruiter submissions (pending/approved/rejected)",
        security: [{ AdminAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected"] }, description: "Filter by status (default: pending)" },
        ],
        responses: {
          "200": { description: "List of submissions", content: { "application/json": { schema: { type: "object", properties: { submissions: { type: "array", items: { $ref: "#/components/schemas/RecruiterSubmission" } }, count: { type: "integer" } } } } } },
        },
      },
    },
    "/api/admin/submissions/{id}/approve": {
      post: {
        summary: "Approve a submission — creates a Recruiter record",
        security: [{ AdminAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "201": { description: "Recruiter approved and created", content: { "application/json": { schema: { $ref: "#/components/schemas/Recruiter" } } } },
          "400": { description: "Already processed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Submission not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/admin/submissions/{id}/reject": {
      post: {
        summary: "Reject a submission",
        security: [{ AdminAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "Submission rejected" },
          "400": { description: "Already processed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Submission not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
};
}

export default buildOpenApiSpec;
