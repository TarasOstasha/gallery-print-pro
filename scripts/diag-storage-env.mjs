import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const raw = readFileSync(envPath, "utf8");
const fileEnv = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  fileEnv[m[1]] = v;
}

function classifyKey(value) {
  if (!value) return { present: false, validServiceRole: false, kind: "missing" };
  if (value.startsWith("sb_secret_")) {
    return { present: true, validServiceRole: true, kind: "sb_secret_" };
  }
  if (value.startsWith("sb_publishable_")) {
    return { present: true, validServiceRole: false, kind: "sb_publishable_ (not service role)" };
  }
  const parts = value.split(".");
  if (parts.length === 3 && value.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
      );
      return {
        present: true,
        validServiceRole: payload.role === "service_role",
        kind: `jwt role=${payload.role ?? "?"}`,
      };
    } catch {
      return { present: true, validServiceRole: false, kind: "jwt unparseable" };
    }
  }
  return {
    present: true,
    validServiceRole: false,
    kind: `unknown prefix=${value.slice(0, 12)}… len=${value.length}`,
  };
}

// Same logic as db.server isServiceRoleKey
function isServiceRoleKey(value) {
  if (!value) return false;
  if (value.startsWith("sb_secret_")) return true;
  if (value.split(".").length !== 3) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    );
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

const keys = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

console.log("=== From .env file ===");
for (const k of keys) {
  const v = fileEnv[k];
  if (k.includes("KEY")) {
    const c = classifyKey(v);
    console.log(
      `${k}: present=${c.present} kind=${c.kind} isServiceRoleKey=${isServiceRoleKey(v)}`,
    );
  } else {
    console.log(`${k}: present=${Boolean(v)} valueLooksLikeUrl=${Boolean(v && v.startsWith("http"))}`);
  }
}

console.log("\n=== process.env (without loading .env) ===");
for (const k of keys) {
  const v = process.env[k];
  if (k.includes("KEY")) {
    const c = classifyKey(v);
    console.log(
      `${k}: present=${c.present} kind=${c.kind} isServiceRoleKey=${isServiceRoleKey(v)}`,
    );
  } else {
    console.log(`${k}: present=${Boolean(v)}`);
  }
}

// Simulate db.server loadEnv
for (const [k, v] of Object.entries(fileEnv)) {
  if (!process.env[k]) process.env[k] = v;
}
console.log("\n=== After db.server-style loadEnv ===");
{
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const c = classifyKey(v);
  console.log(
    `SUPABASE_SERVICE_ROLE_KEY: present=${c.present} kind=${c.kind} isServiceRoleKey=${isServiceRoleKey(v)}`,
  );
  console.log(`SUPABASE_URL: present=${Boolean(process.env.SUPABASE_URL)}`);
}
