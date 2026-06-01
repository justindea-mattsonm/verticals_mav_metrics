#!/usr/bin/env node
/**
 * Tiny idempotent migration runner.
 *
 *   node scripts/migrate.mjs
 *
 * Reads files from db/migrations/*.sql in lexicographic order and applies any
 * that aren't recorded in the `_migrations` table. Uses
 * DATABASE_URL_UNPOOLED if available (required for DDL over PgBouncer),
 * otherwise falls back to DATABASE_URL.
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import pkg from "pg";
const { Client } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, "..", "db", "migrations");

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[migrate] No DATABASE_URL_UNPOOLED or DATABASE_URL in env.\n" +
      "          Run `vercel env pull .env.development.local` first, or\n" +
      "          export DATABASE_URL_UNPOOLED=... manually.",
  );
  process.exit(1);
}

async function loadEnvFile() {
  // Best-effort: if .env.development.local exists, load it into process.env
  // without pulling in dotenv as a dependency.
  const path = resolve(__dirname, "..", ".env.development.local");
  try {
    const txt = await readFile(path, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        process.env[m[1]] = v;
      }
    }
  } catch {
    // file optional
  }
}

async function main() {
  await loadEnvFile();
  const effective =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!effective) {
    console.error("[migrate] still no connection string after env load");
    process.exit(1);
  }

  const client = new Client({
    connectionString: effective,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // Ensure _migrations exists so we can record progress (the first migration
    // creates the table too; this is just for the "what's already applied" probe).
    await client.query(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const applied = new Set(
      (await client.query("select name from _migrations")).rows.map(
        (r) => r.name,
      ),
    );

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const f of files) {
      const name = f.replace(/\.sql$/, "");
      if (applied.has(name)) {
        console.log(`[migrate] skip  ${name} (already applied)`);
        continue;
      }
      console.log(`[migrate] apply ${name}`);
      const sql = await readFile(join(MIGRATIONS_DIR, f), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        // The migration may insert itself; insert defensively too.
        await client.query(
          "insert into _migrations (name) values ($1) on conflict (name) do nothing",
          [name],
        );
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
      ran += 1;
    }
    console.log(`[migrate] done. ran ${ran} new migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err.message ?? err);
  process.exit(1);
});
