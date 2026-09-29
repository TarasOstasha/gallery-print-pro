import postgres from "postgres";
import { getServerEnv } from "@/server/env.server";

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
    const payload = JSON.parse(decodeJwtPayload(value.split(".")[1]!)) as { role?: string };
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

/** Workers-safe base64url → UTF-8 (no Node Buffer required). */
function decodeJwtPayload(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  // Node / local fallback
  return Buffer.from(padded, "base64").toString("utf8");
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getDatabaseUrl(): string {
  const url = getServerEnv("DATABASE_URL") || getServerEnv("LOVABLE_DB_MIGRATION_URL");
  if (!url) throw new Error("Missing DATABASE_URL");
  return url;
}

export function createDb() {
  return postgres(getDatabaseUrl(), { max: 1, prepare: false });
}
