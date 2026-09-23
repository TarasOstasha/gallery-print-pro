import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = readFileSync(join(root, ".env"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
try {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `;
  console.log("tables:", tables.map((t) => t.table_name).join(", "));
  const products = await sql`select count(*)::int as n from products`;
  const variants = await sql`select count(*)::int as n from product_variants`;
  console.log("products:", products[0].n, "variants:", variants[0].n);
  const buckets = await sql`select id from storage.buckets order by id`;
  console.log("buckets:", buckets.map((b) => b.id).join(", ") || "(none)");
  console.log("service_role_set:", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
  console.log("project:", process.env.SUPABASE_PROJECT_ID);
} catch (e) {
  console.error("verify failed:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
