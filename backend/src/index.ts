import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import adminRoutes from "./routes/admin.js";
import postsRoutes from "./routes/posts.js";
import submissionsRoutes from "./routes/submissions.js";
import profileRoutes from "./routes/profile.js";
import { clerkOptionalAuth } from "./lib/clerk-auth.js";
import buildOpenApiSpec from "./openapi-spec.js";

const app = new Hono();

app.use("*", logger());
app.use("*", clerkOptionalAuth);
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = (process.env.CORS_ORIGIN ?? "*")
        .split(",")
        .map((o) => o.trim());
      if (allowed.includes("*")) return "*";
      if (origin && allowed.includes(origin)) return origin;
      return null;
    },
  }),
);

// Swagger UI at /docs
app.get("/docs", swaggerUI({ url: "/api/openapi.json" }));

// Serve OpenAPI spec as JSON
app.get("/api/openapi.json", (c) => {
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  return c.json(buildOpenApiSpec(baseUrl));
});

app.route("/api/admin", adminRoutes);
app.route("/api/posts", postsRoutes);
app.route("/api/profile", profileRoutes);
app.route("/api", submissionsRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
