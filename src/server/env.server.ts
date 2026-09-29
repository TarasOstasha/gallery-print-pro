/**
 * Read a server env var with paste-safe normalization.
 * Strips surrounding quotes/whitespace (common when copying from .env into a host UI).
 * On Cloudflare Workers, Nitro usually mirrors bindings onto process.env per request.
 */
export function getServerEnv(name: string): string | undefined {
  return normalizeEnvValue(process.env[name]);
}

function normalizeEnvValue(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  let v = String(value).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v || undefined;
}
