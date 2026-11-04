// Shapes DATABASE_URL for Prisma on Vercel Functions.
//
// Recommended prod shape (see "Database connection" in DEPLOYMENT.md): the
// Supabase session pooler on port 5432 without `pgbouncer=true`, and
// `connection_limit=5`. Session mode keeps one server connection per client
// connection, so Prisma's prepared statements work and every query is a single
// round trip. `pgbouncer=true` is only needed for the transaction pooler
// (port 6543); elsewhere it costs extra `DEALLOCATE ALL` / `BEGIN` / `COMMIT`
// round trips per query.

/** Pool size per function instance when the URL does not set one. */
export const DEFAULT_CONNECTION_LIMIT = 5;

export interface DatasourceConfig {
  url: string | undefined;
  warnings: string[];
}

/**
 * Pure: returns the URL Prisma should use plus any configuration warnings.
 * Explicit `connection_limit` / `pgbouncer` values are always kept as is.
 */
export function resolveDatasourceUrl(raw: string | undefined): DatasourceConfig {
  if (!raw) return { url: raw, warnings: [] };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    // Let Prisma report the malformed URL itself.
    return { url: raw, warnings: [] };
  }

  const warnings: string[] = [];
  const params = parsed.searchParams;

  // Append rather than re-serialize, so the rest of the URL stays byte-identical.
  let url = raw;
  if (!params.has("connection_limit")) {
    const separator = /[?&]$/.test(raw) ? "" : raw.includes("?") ? "&" : "?";
    url += `${separator}connection_limit=${DEFAULT_CONNECTION_LIMIT}`;
  }

  const pgbouncer = params.get("pgbouncer") === "true";
  const port = parsed.port || "5432";
  if (pgbouncer && port === "5432") {
    warnings.push(
      "DATABASE_URL sets pgbouncer=true on port 5432 (session pooler). Drop pgbouncer=true there: it adds several round trips per query.",
    );
  }
  if (params.get("connection_limit") === "1") {
    warnings.push(
      "DATABASE_URL sets connection_limit=1, so concurrent queries on an instance queue on one connection. Use 3-5.",
    );
  }

  return { url, warnings };
}
