#!/usr/bin/env node
/**
 * Smoke-test: create a paid studio-pickup order via DATABASE_URL.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
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

const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const tinyJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwABTP/Z",
  "base64",
);

const sql = postgres(url, { max: 1, prepare: false });

try {
  await sql`
    create table if not exists public.print_file_blobs (
      photo_id uuid primary key references public.photos(id) on delete cascade,
      mime_type text not null,
      file_name text not null,
      content bytea not null,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    insert into public.events (id, slug, title, description, is_published, downloads_enabled, sort_order)
    values (${EVENT_ID}::uuid, 'customer-uploads', 'Customer uploads', 'Customer uploads', false, false, 99)
    on conflict (id) do nothing
  `;

  const variants = await sql`
    select id, size_label, price_cents from public.product_variants
    where product_id = ${PRODUCT_ID}::uuid and size_label = '8x10' limit 1
  `;
  if (!variants[0]) throw new Error("Missing 8x10 variant");

  const photoNumber = `IMG_E2E_${Date.now()}`;
  const photos = await sql`
    insert into public.photos (event_id, photo_number, preview_url, width, height)
    values (${EVENT_ID}::uuid, ${photoNumber}, ${"blob://e2e"}, 800, 1000)
    returning id
  `;
  const photoId = photos[0].id;

  await sql`
    insert into public.print_file_blobs (photo_id, mime_type, file_name, content)
    values (${photoId}::uuid, 'image/jpeg', 'e2e.jpg', ${tinyJpeg})
  `;

  const email = "test-order@dynastypix.local";
  let customerId;
  const existing = await sql`select id from public.customers where lower(email) = ${email} limit 1`;
  if (existing[0]) customerId = existing[0].id;
  else {
    const created = await sql`
      insert into public.customers (email, first_name, last_name, phone)
      values (${email}, 'Test', 'Customer', '555-0100')
      returning id
    `;
    customerId = created[0].id;
  }

  const orderNumberRows = await sql`select public.next_order_number() as n`;
  const orderNumber = String(orderNumberRows[0].n);
  const unit = variants[0].price_cents;
  const tax = Math.round(unit * 0.08);
  const total = unit + tax;

  const orders = await sql`
    insert into public.orders (
      order_number, customer_id, subtotal_cents, shipping_cents, tax_cents, total_cents,
      fulfillment_method, payment_status, order_status, fulfillment_provider, fulfillment_reference
    ) values (
      ${orderNumber}, ${customerId}::uuid, ${unit}, 0, ${tax}, ${total},
      'studio_pickup'::public.fulfillment_method,
      'paid'::public.payment_status,
      'new'::public.order_status,
      'manual_studio',
      ${`STUDIO-${orderNumber}`}
    )
    returning id, order_number, access_token, total_cents
  `;

  await sql`
    insert into public.order_items (
      order_id, photo_id, product_variant_id, quantity, unit_price_cents, line_total_cents,
      photo_number_snapshot, product_name_snapshot, size_label_snapshot
    ) values (
      ${orders[0].id}::uuid, ${photoId}::uuid, ${variants[0].id}::uuid, 1, ${unit}, ${unit},
      ${photoNumber}, 'Photographic Print', '8x10'
    )
  `;

  await sql`
    insert into public.payments (order_id, provider, amount_cents, status)
    values (${orders[0].id}::uuid, 'mock', ${total}, 'paid'::public.payment_status)
  `;

  console.log("persisted: database");
  console.log("orderNumber:", orders[0].order_number);
  console.log("total_cents:", orders[0].total_cents);
  console.log("e2e order OK");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await sql.end();
}
