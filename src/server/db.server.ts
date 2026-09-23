import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

/** Returns true when SUPABASE_SERVICE_ROLE_KEY looks like a real service role secret. */
export function isServiceRoleKey(value: string | undefined): boolean {
  if (!value) return false;
  if (value.startsWith("sb_secret_")) return true;
  if (value.split(".").length !== 3) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(value.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    ) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.LOVABLE_DB_MIGRATION_URL;
  if (!url) throw new Error("Missing DATABASE_URL in .env");
  return url;
}

export function createDb() {
  return postgres(getDatabaseUrl(), { max: 1, prepare: false });
}
