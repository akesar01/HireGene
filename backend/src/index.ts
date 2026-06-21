import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import adminRoutes from "./routes/admin";
import postsRoutes from "./routes/posts";
import submissionsRoutes from "./routes/submissions";
import openApiSpec from "./openapi-spec";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "*",
  }),
);

// Swagger UI at /docs
app.get("/docs", swaggerUI({ url: "/api/openapi.json" }));

// Serve OpenAPI spec as JSON
app.get("/api/openapi.json", (c) => c.json(openApiSpec));

app.route("/api/admin", adminRoutes);
app.route("/api/posts", postsRoutes);
app.route("/api", submissionsRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
