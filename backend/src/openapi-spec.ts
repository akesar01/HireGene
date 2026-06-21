const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "HireGene API",
    version: "1.0.0",
    description: "Community-driven job discovery platform. Watch real hiring managers across LinkedIn and X.",
  },
  servers: [
    { url: "http://localhost:8787", description: "Local dev" },
  ],
  components: {
    securitySchemes: {
      AdminAuth: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: "Bearer <ADMIN_SECRET>",
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
          { name: "sort", in: "query", schema: { type: "string", enum: ["new", "top", "hot"] }, description: "Sort order (default: new)" },
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
          { name: "mode", in: "query", schema: { type: "string", enum: ["expired", "all", "olderThan"] }, description: "Clear mode (default: expired — only deletes jobs past their 7-day expiry)" },
          { name: "olderThanDays", in: "query", schema: { type: "integer" }, description: "Days threshold for olderThan mode (default: 7)" },
        ],
        responses: {
          "200": { description: "Jobs cleared", content: { "application/json": { schema: { type: "object", properties: { deleted: { type: "integer" }, mode: { type: "string" }, description: { type: "string" } } } } } },
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

export default openApiSpec;
