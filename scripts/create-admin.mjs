#!/usr/bin/env node
/**
 * Creates a local admin user in your Supabase Auth schema + user_roles.
 * Usage: node scripts/create-admin.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

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

const email = (process.env.ADMIN_EMAIL || "admin@dynastypix.local").toLowerCase();
const password = process.env.ADMIN_PASSWORD || "DynastyAdmin2026!";

const sql = postgres(url, { max: 1, prepare: false });

try {
  await sql`create extension if not exists pgcrypto`;

  const existing = await sql`
    select id from auth.users where lower(email) = ${email} limit 1
  `;

  let userId = existing[0]?.id;
  if (!userId) {
    userId = randomUUID();
    const identityData = { sub: userId, email };

    await sql`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        ${userId}::uuid,
        'authenticated',
        'authenticated',
        ${email},
        crypt(${password}, gen_salt('bf')),
        now(),
        ${sql.json({ provider: "email", providers: ["email"] })},
        ${sql.json({})},
        now(),
        now(),
        '',
        '',
        '',
        ''
      )
    `;

    await sql`
      insert into auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) values (
        ${randomUUID()}::uuid,
        ${userId}::uuid,
        ${sql.json(identityData)},
        'email',
        ${userId},
        now(),
        now(),
        now()
      )
    `;
    console.log("Created auth user:", email);
  } else {
    await sql`
      update auth.users
      set encrypted_password = crypt(${password}, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = ${userId}::uuid
    `;
    console.log("Updated password for existing user:", email);
  }

  await sql`
    insert into public.user_roles (user_id, role)
    values (${userId}::uuid, 'admin'::public.app_role)
    on conflict (user_id, role) do nothing
  `;

  await sql`
    update public.studio_settings
    set studio_name = 'Dynasty Pix', updated_at = now()
  `;

  console.log("Admin role granted.");
  console.log("");
  console.log("Sign in at /auth with:");
  console.log("  email:   ", email);
  console.log("  password:", password);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await sql.end();
}
