import { describe, expect, it } from "vitest";
import { DEFAULT_CONNECTION_LIMIT, resolveDatasourceUrl } from "../src/lib/db-url";

const session = "postgresql://postgres.ref:pa%40ss@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

describe("resolveDatasourceUrl", () => {
  it("passes an unset URL through", () => {
    expect(resolveDatasourceUrl(undefined)).toEqual({ url: undefined, warnings: [] });
  });

  it("defaults connection_limit on a session pooler URL without one", () => {
    const { url, warnings } = resolveDatasourceUrl(session);
    expect(url).toBe(`${session}?connection_limit=${DEFAULT_CONNECTION_LIMIT}`);
    expect(warnings).toEqual([]);
  });

  it("appends to an existing query string without rewriting it", () => {
    const raw = `${session}?sslmode=require&options=-c%20search_path%3Dpublic`;
    expect(resolveDatasourceUrl(raw).url).toBe(`${raw}&connection_limit=5`);
    expect(resolveDatasourceUrl(`${session}?`).url).toBe(`${session}?connection_limit=5`);
  });

  it("keeps an explicit connection_limit", () => {
    const raw = `${session}?connection_limit=3`;
    expect(resolveDatasourceUrl(raw)).toEqual({ url: raw, warnings: [] });
  });

  it("keeps the transaction pooler's pgbouncer mode without warning", () => {
    const raw = "postgresql://u:p@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5";
    expect(resolveDatasourceUrl(raw)).toEqual({ url: raw, warnings: [] });
  });

  it("warns about pgbouncer=true on the session pooler and connection_limit=1", () => {
    const raw = `${session}?pgbouncer=true&connection_limit=1`;
    const { url, warnings } = resolveDatasourceUrl(raw);
    expect(url).toBe(raw);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("pgbouncer=true");
    expect(warnings[1]).toContain("connection_limit=1");
  });

  it("leaves a malformed URL for Prisma to report", () => {
    expect(resolveDatasourceUrl("not a url")).toEqual({ url: "not a url", warnings: [] });
  });
});
