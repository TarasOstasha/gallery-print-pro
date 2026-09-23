#!/usr/bin/env node
/**
 * Apply drizzle SQL migrations to YOUR Supabase Postgres.
 * Usage: node scripts/apply-supabase-migrations.mjs
 * Requires DATABASE_URL or LOVABLE_DB_MIGRATION_URL in .env
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(join(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* no .env */
  }
}

loadEnv();

const url = process.env.DATABASE_URL || process.env.LOVABLE_DB_MIGRATION_URL;
if (!url) {
  console.error(
    "Missing DATABASE_URL (or LOVABLE_DB_MIGRATION_URL).\n" +
      "Get it from Supabase → Project Settings → Database → Connection string (URI).",
  );
  process.exit(1);
}

const migrationsDir = join(root, "drizzle", "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sql = postgres(url, { max: 1, prepare: false });

try {
  await sql`create schema if not exists drizzle`;
  await sql`
    create table if not exists drizzle.__migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  for (const file of files) {
    const already = await sql`
      select 1 from drizzle.__migrations where id = ${file} limit 1
    `;
    if (already.length) {
      console.log(`skip  ${file}`);
      continue;
    }
    const body = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`apply ${file}…`);
    await sql.unsafe(body);
    await sql`insert into drizzle.__migrations (id) values (${file})`;
    console.log(`ok    ${file}`);
  }

  // Storage buckets used by print uploads / originals
  await sql`
    insert into storage.buckets (id, name, public)
    values
      ('photo-previews', 'photo-previews', false),
      ('photo-originals', 'photo-originals', false)
    on conflict (id) do nothing
  `;
  console.log("ok    storage buckets photo-previews, photo-originals");

  console.log("\nDone. Next:");
  console.log("1. Put SUPABASE_URL + keys in .env (see .env.example)");
  console.log("2. Restart npm run dev");
  console.log("3. Sign up at /auth, then insert admin role in SQL Editor");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await sql.end();
}
