import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg";

/**
 * Neon Postgres connection helper.
 *
 * Env conventions match the Vercel ↔ Neon Marketplace integration:
 *   - DATABASE_URL          — pooled (PgBouncer), used for app reads
 *   - DATABASE_URL_UNPOOLED — direct connection, used for migrations / DDL
 *
 * A single Pool is reused across requests via globalThis so HMR + serverless
 * cold-warm transitions don't leak connections.
 */

const globalForPool = globalThis as unknown as { _pgPool?: Pool };

function poolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    // Neon requires SSL; the URL usually carries sslmode=require, but be defensive.
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}

export function getPool(): Pool {
  if (globalForPool._pgPool) return globalForPool._pgPool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Run `vercel env pull .env.development.local` " +
        "or add the Vercel ↔ Neon integration to this project.",
    );
  }

  const pool = new Pool(poolConfig(url));
  pool.on("error", (err) => {
    // Surface unexpected errors but never crash the request loop.
    console.error("[db] unexpected pool error", err);
  });

  globalForPool._pgPool = pool;
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params as never[]);
}

/**
 * Returns true if the named table exists in the public schema. Useful for
 * graceful degradation when the schema migration hasn't run yet.
 */
export async function tableExists(name: string): Promise<boolean> {
  const r = await query<{ exists: boolean }>(
    `select to_regclass($1) is not null as exists`,
    [`public.${name}`],
  );
  return Boolean(r.rows[0]?.exists);
}
