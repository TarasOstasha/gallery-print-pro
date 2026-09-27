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
  return describeServiceRoleKey(value).ok;
}

/** Safe metadata about a Supabase key (never includes the secret itself). */
export function describeServiceRoleKey(value: string | undefined): {
  ok: boolean;
  present: boolean;
  kind: string;
} {
  if (!value) return { ok: false, present: false, kind: "missing" };
  if (value.startsWith("sb_secret_")) {
    return { ok: true, present: true, kind: "sb_secret_" };
  }
  if (value.startsWith("sb_publishable_")) {
    return { ok: false, present: true, kind: "sb_publishable_" };
  }
  if (value.split(".").length !== 3) {
    return { ok: false, present: true, kind: "non_jwt" };
  }
  try {
    const payload = JSON.parse(
      Buffer.from(value.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    ) as { role?: string };
    const role = payload.role ?? "unknown";
    return {
      ok: role === "service_role",
      present: true,
      kind: `jwt:${role}`,
    };
  } catch {
    return { ok: false, present: true, kind: "jwt_unparseable" };
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
