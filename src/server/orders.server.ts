import { createDb, describeServiceRoleKey } from "@/server/db.server";
import {
  FINE_ART_PRINT_ID,
  PHOTOGRAPHIC_PRINT_ID,
  findPrintSku,
  resolveMounting,
  resolvePrintSku,
  unitPriceCents,
  type ResolvedPrintSku,
} from "@/lib/print-catalog";
import { DEFAULT_CROP_X, DEFAULT_CROP_Y, clampCropPercent } from "@/lib/print-preview";

export const CUSTOMER_UPLOAD_EVENT_ID = "33333333-3333-4333-8333-333333333333";

/** Merchandise subtotal minimum (cents). Shipping/tax do not count. */
export const MIN_ORDER_SUBTOTAL_CENTS = 2000;

export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

export function isOrderValidationError(error: unknown): boolean {
  return (
    error instanceof OrderValidationError ||
    (error instanceof Error && error.name === "OrderValidationError")
  );
}

export type CreateOrderInput = {
  fulfillment: "shipping" | "studio_pickup";
  shippingMethodCode: string | null;
  termsAccepted: boolean;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    address: string;
    apartment?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  } | null;
  items: Array<{
    photoId: string;
    photoNumber: string;
    productVariantId: string;
    sizeLabel: string;
    quantity: number;
    border?: boolean;
    mountingId?: string;
    cropX?: number;
    cropY?: number;
  }>;
  photoFiles: Array<{
    photoId: string;
    photoNumber: string;
    base64: string;
    mimeType: string;
    fileName: string;
    width: number;
    height: number;
  }>;
  totals: {
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
  };
};

export type CreateOrderResult = {
  orderNumber: string;
  accessToken: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  persisted: "database" | "local";
};

function decodeBase64(data: string): Uint8Array {
  return new Uint8Array(Buffer.from(data, "base64"));
}

function normalizeCropPercent(value: unknown, fallback: number, label: string): number {
  const raw = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const clamped = clampCropPercent(raw);
  if (clamped !== raw && typeof value === "number" && Number.isFinite(value)) {
    // Allow tiny float noise inside 0–100; reject out-of-range values.
  }
  if (typeof value === "number" && Number.isFinite(value) && (value < 0 || value > 100)) {
    throw new OrderValidationError(`${label} must be between 0 and 100.`);
  }
  if (value !== undefined && value !== null && typeof value !== "number") {
    throw new OrderValidationError(`Invalid ${label}.`);
  }
  return clamped;
}

/** Terms + crop shape checks (no pricing). Safe to call before DB writes. */
export function assertOrderRequestGates(input: CreateOrderInput): void {
  if (input.termsAccepted !== true) {
    throw new OrderValidationError("Please agree to the Print Cancellation Policy & Terms.");
  }
  if (!input.items?.length) {
    throw new OrderValidationError("Your cart is empty.");
  }
  for (const item of input.items) {
    if (!item.quantity || item.quantity < 1) {
      throw new OrderValidationError("Invalid item quantity.");
    }
    normalizeCropPercent(item.cropX, DEFAULT_CROP_X, "cropX");
    normalizeCropPercent(item.cropY, DEFAULT_CROP_Y, "cropY");
  }
}

/** Catalog-only merchandise subtotal (no shipping/tax). Used for local fallback gates. */
export function merchandiseSubtotalFromCatalog(items: CreateOrderInput["items"]): number {
  let subtotalCents = 0;
  for (const item of items) {
    const sku = resolvePrintSku(item.productVariantId);
    if (!sku) {
      throw new OrderValidationError(`Unavailable product for ${item.sizeLabel || "selection"}.`);
    }
    const mounting = resolveMounting(sku.sizeLabel, item.mountingId || "print-only");
    if (!mounting) {
      throw new OrderValidationError(`Unavailable mounting for ${sku.sizeLabel}.`);
    }
    subtotalCents += unitPriceCents(sku.priceCents, mounting.priceCents) * item.quantity;
  }
  return subtotalCents;
}

export function assertMinimumMerchandiseSubtotal(subtotalCents: number): void {
  if (subtotalCents < MIN_ORDER_SUBTOTAL_CENTS) {
    throw new OrderValidationError("Minimum order is $20.00.");
  }
}

async function resolveSkuForItem(
  sql: ReturnType<typeof createDb>,
  item: CreateOrderInput["items"][number],
): Promise<ResolvedPrintSku> {
  const fromCatalog = resolvePrintSku(item.productVariantId);
  if (fromCatalog) return fromCatalog;

  // Legacy carts may still carry a product_variants UUID from the old single-finish catalog.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    item.productVariantId,
  );
  if (isUuid) {
    const rows = await sql<{
      product_id: string;
      finish: string | null;
      size_label: string;
    }[]>`
      select product_id::text, finish, size_label
      from public.product_variants
      where id = ${item.productVariantId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (row) {
      const sku = findPrintSku(row.product_id, row.finish || "lustre", row.size_label);
      if (sku) return sku;
    }
  }

  // Last resort for older local carts that only stored size labels for Lustre.
  const lustreFallback = findPrintSku(PHOTOGRAPHIC_PRINT_ID, "lustre", item.sizeLabel);
  if (lustreFallback) return lustreFallback;

  throw new Error(`Unknown or unpriced print selection: ${item.sizeLabel}`);
}

/** Upsert DB variant row so order_items FK stays valid; pricing still comes from catalog. */
async function ensureProductVariantId(
  sql: ReturnType<typeof createDb>,
  sku: ResolvedPrintSku,
): Promise<string> {
  const description =
    sku.productId === FINE_ART_PRINT_ID
      ? "Museum-quality fine art papers, printed to order."
      : "Archival photographic paper, printed to order.";
  const sortOrder = sku.productId === FINE_ART_PRINT_ID ? 2 : 1;

  await sql`
    insert into public.products (id, name, category, description, is_active, sort_order)
    values (
      ${sku.productId}::uuid,
      ${sku.productName},
      'Prints',
      ${description},
      true,
      ${sortOrder}
    )
    on conflict (id) do update
    set name = excluded.name,
        is_active = true
  `;

  const rows = await sql<{ id: string }[]>`
    insert into public.product_variants (
      product_id, finish, size_label, width_in, height_in, price_cents, is_active, sort_order
    ) values (
      ${sku.productId}::uuid,
      ${sku.finishId},
      ${sku.sizeLabel},
      ${sku.width},
      ${sku.height},
      ${sku.priceCents},
      true,
      0
    )
    on conflict (product_id, finish, size_label) do update
    set width_in = excluded.width_in,
        height_in = excluded.height_in,
        price_cents = excluded.price_cents,
        is_active = true
    returning id
  `;

  if (!rows[0]?.id) {
    throw new Error(
      "Print catalog is not migrated. Run npm run db:migrate (migration 0002_print_finish_catalog).",
    );
  }
  return rows[0].id;
}

/**
 * Persists an order using DATABASE_URL (trusted server).
 * Full-resolution customer originals MUST land in Supabase Storage (photo-originals).
 * Postgres stores metadata/paths only — never new print_file_blobs binaries.
 */
export async function createOrderInDatabase(input: CreateOrderInput): Promise<CreateOrderResult> {
  assertOrderRequestGates(input);

  const keyStatus = describeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!keyStatus.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[createOrderInDatabase] Storage blocked: invalid service role key", {
        present: keyStatus.present,
        kind: keyStatus.kind,
        supabaseUrlPresent: Boolean(process.env.SUPABASE_URL),
        hint:
          keyStatus.kind === "jwt:anon"
            ? "SUPABASE_SERVICE_ROLE_KEY is currently an anon JWT. Replace it with the service_role secret (or sb_secret_…) from Supabase → Settings → API."
            : "Set SUPABASE_SERVICE_ROLE_KEY to the service_role JWT or sb_secret_… key (not anon/publishable).",
      });
    } else {
      console.error(
        "[createOrderInDatabase] SUPABASE_SERVICE_ROLE_KEY is missing or not a service_role key",
      );
    }
    throw new OrderValidationError(
      "Photo storage is temporarily unavailable. Please try again later.",
    );
  }

  const sql = createDb();
  try {
    // Legacy table may still hold older test-order binaries; keep schema for deletion/compat.
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
      values (
        ${CUSTOMER_UPLOAD_EVENT_ID}::uuid,
        'customer-uploads',
        'Customer uploads',
        'Photos uploaded by customers for print orders.',
        false,
        false,
        99
      )
      on conflict (id) do nothing
    `;

    const shippingRows = await sql<{ code: string; price_cents: number }[]>`
      select code, price_cents from public.shipping_methods where is_active = true
    `;
    const shippingPrices = new Map(shippingRows.map((r) => [r.code, r.price_cents]));

    const studioRows = await sql<{ tax_rate: string }[]>`
      select tax_rate::text from public.studio_settings limit 1
    `;
    const taxRate = studioRows[0]?.tax_rate ? Number(studioRows[0].tax_rate) : 0.08;

    let subtotalCents = 0;
    const lineItems: Array<{
      clientPhotoId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
      printPriceCents: number;
      mountingPriceCents: number;
      hasBorder: boolean;
      mountingCode: string;
      photoNumber: string;
      sizeLabel: string;
      productName: string;
      cropX: number;
      cropY: number;
    }> = [];

    for (const item of input.items) {
      // Server-side pricing from print-catalog.ts — never trust browser amounts.
      const sku = await resolveSkuForItem(sql, item);
      const mounting = resolveMounting(sku.sizeLabel, item.mountingId || "print-only");
      if (!mounting) {
        throw new Error(`Unavailable mounting for ${sku.sizeLabel}`);
      }
      const hasBorder = Boolean(item.border);
      const printPriceCents = sku.priceCents;
      const mountingPriceCents = mounting.priceCents;
      const lineUnit = unitPriceCents(printPriceCents, mountingPriceCents);
      const variantId = await ensureProductVariantId(sql, sku);
      const cropX = normalizeCropPercent(item.cropX, DEFAULT_CROP_X, "cropX");
      const cropY = normalizeCropPercent(item.cropY, DEFAULT_CROP_Y, "cropY");
      const productName = [
        sku.displayName,
        hasBorder ? "White border" : null,
        mounting.name,
      ]
        .filter(Boolean)
        .join(" · ");

      subtotalCents += lineUnit * item.quantity;
      lineItems.push({
        clientPhotoId: item.photoId,
        variantId,
        quantity: item.quantity,
        unitPrice: lineUnit,
        printPriceCents,
        mountingPriceCents,
        hasBorder,
        mountingCode: mounting.id,
        photoNumber: item.photoNumber,
        sizeLabel: sku.sizeLabel,
        productName,
        cropX,
        cropY,
      });
    }

    // Authoritative merchandise subtotal — shipping/tax must not satisfy the minimum.
    assertMinimumMerchandiseSubtotal(subtotalCents);

    let shippingCents = 0;
    let shippingMethodCode: string | null = input.shippingMethodCode;
    if (input.fulfillment === "studio_pickup") {
      // Pickup is paid online later (Stripe) — never pay-at-pickup, never charged shipping.
      shippingCents = 0;
      shippingMethodCode = null;
    } else if (input.fulfillment === "shipping") {
      if (!input.shippingMethodCode) {
        throw new OrderValidationError("Please select a shipping method.");
      }
      if (!shippingPrices.has(input.shippingMethodCode)) {
        throw new OrderValidationError("Invalid shipping method.");
      }
      shippingCents = shippingPrices.get(input.shippingMethodCode)!;
      shippingMethodCode = input.shippingMethodCode;
    } else {
      throw new OrderValidationError("Invalid delivery method.");
    }

    const taxCents = Math.round((subtotalCents + shippingCents) * taxRate);
    const totalCents = subtotalCents + shippingCents + taxCents;

    // Upload every unique customer original to Storage BEFORE creating the order.
    const requiredPhotoIds = new Set(lineItems.map((l) => l.clientPhotoId));
    const uploadedFiles = input.photoFiles.filter((f) => requiredPhotoIds.has(f.photoId));
    for (const photoId of requiredPhotoIds) {
      if (!uploadedFiles.some((f) => f.photoId === photoId)) {
        throw new OrderValidationError(
          "One or more photos are missing from your order. Please return to Print and try again.",
        );
      }
    }

    const photoIdMap = new Map<string, string>();
    for (const file of uploadedFiles) {
      const dbPhotoId = await upsertCustomerPhotoToStorage(sql, file);
      photoIdMap.set(file.photoId, dbPhotoId);
    }

    const email = input.customer.email.trim().toLowerCase();
    const existing = await sql<{ id: string }[]>`
      select id from public.customers where lower(email) = ${email} limit 1
    `;
    let customerId = existing[0]?.id;
    if (!customerId) {
      const created = await sql<{ id: string }[]>`
        insert into public.customers (email, first_name, last_name, phone)
        values (
          ${email},
          ${input.customer.firstName.trim()},
          ${input.customer.lastName.trim()},
          ${input.customer.phone?.trim() || null}
        )
        returning id
      `;
      customerId = created[0]!.id;
    } else {
      await sql`
        update public.customers
        set first_name = ${input.customer.firstName.trim()},
            last_name = ${input.customer.lastName.trim()},
            phone = ${input.customer.phone?.trim() || null}
        where id = ${customerId}::uuid
      `;
    }

    const orderNumberRows = await sql<{ n: string }[]>`
      select public.next_order_number() as n
    `;
    const orderNumber = String(orderNumberRows[0]!.n);

    // Ensure optional columns exist before insert (migrations 0003 / 0004).
    await sql`
      alter table public.order_items
        add column if not exists has_border boolean not null default false
    `;
    await sql`
      alter table public.order_items
        add column if not exists mounting_code text not null default 'print-only'
    `;
    await sql`
      alter table public.order_items
        add column if not exists mounting_price_cents integer not null default 0
    `;
    await sql`
      alter table public.order_items
        add column if not exists print_price_cents integer
    `;
    await sql`
      alter table public.order_items
        add column if not exists crop_x double precision not null default 50
    `;
    await sql`
      alter table public.order_items
        add column if not exists crop_y double precision not null default 50
    `;
    await sql`
      alter table public.orders
        add column if not exists terms_accepted boolean not null default false
    `;
    await sql`
      alter table public.orders
        add column if not exists terms_accepted_at timestamptz
    `;

    const orderRows = await sql<{ id: string; access_token: string }[]>`
      insert into public.orders (
        order_number, customer_id, subtotal_cents, shipping_cents, tax_cents, total_cents,
        fulfillment_method, shipping_method_code, payment_status, order_status, fulfillment_provider,
        terms_accepted, terms_accepted_at
      ) values (
        ${orderNumber},
        ${customerId}::uuid,
        ${subtotalCents},
        ${shippingCents},
        ${taxCents},
        ${totalCents},
        ${input.fulfillment}::public.fulfillment_method,
        ${shippingMethodCode},
        'paid'::public.payment_status,
        'new'::public.order_status,
        'manual_studio',
        true,
        now()
      )
      returning id, access_token
    `;
    const order = orderRows[0]!;

    for (const line of lineItems) {
      const photoId = photoIdMap.get(line.clientPhotoId);
      if (!photoId) throw new Error(`Missing photo for ${line.photoNumber}`);
      await sql`
        insert into public.order_items (
          order_id, photo_id, product_variant_id, quantity, unit_price_cents, line_total_cents,
          photo_number_snapshot, product_name_snapshot, size_label_snapshot,
          has_border, mounting_code, mounting_price_cents, print_price_cents,
          crop_x, crop_y
        ) values (
          ${order.id}::uuid,
          ${photoId}::uuid,
          ${line.variantId}::uuid,
          ${line.quantity},
          ${line.unitPrice},
          ${line.unitPrice * line.quantity},
          ${line.photoNumber},
          ${line.productName},
          ${line.sizeLabel},
          ${line.hasBorder},
          ${line.mountingCode},
          ${line.mountingPriceCents},
          ${line.printPriceCents},
          ${line.cropX},
          ${line.cropY}
        )
      `;
    }

    if (input.fulfillment === "shipping" && input.shippingAddress) {
      const addr = input.shippingAddress;
      await sql`
        insert into public.shipping_addresses (
          order_id, first_name, last_name, email, phone,
          address_line1, address_line2, city, state, postal_code, country
        ) values (
          ${order.id}::uuid,
          ${input.customer.firstName.trim()},
          ${input.customer.lastName.trim()},
          ${email},
          ${input.customer.phone?.trim() || null},
          ${addr.address},
          ${addr.apartment || null},
          ${addr.city},
          ${addr.state},
          ${addr.zip},
          ${addr.country}
        )
      `;
    }

    await sql`
      insert into public.payments (order_id, provider, amount_cents, status)
      values (${order.id}::uuid, 'mock', ${totalCents}, 'paid'::public.payment_status)
    `;

    const { getFulfillmentProvider } = await import("@/lib/fulfillment.server");
    const fulfillment = await getFulfillmentProvider().submitOrder({
      orderNumber,
      fulfillmentMethod: input.fulfillment,
      shippingMethodCode,
      items: lineItems.map((line) => ({
        photoId: photoIdMap.get(line.clientPhotoId)!,
        photoNumber: line.photoNumber,
        originalPath: null,
        productName: line.productName,
        sizeLabel: line.sizeLabel,
        quantity: line.quantity,
      })),
      shipTo:
        input.fulfillment === "shipping" && input.shippingAddress
          ? {
              name: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
              addressLine1: input.shippingAddress.address,
              addressLine2: input.shippingAddress.apartment || null,
              city: input.shippingAddress.city,
              state: input.shippingAddress.state,
              postalCode: input.shippingAddress.zip,
              country: input.shippingAddress.country,
            }
          : null,
    });

    await sql`
      update public.orders
      set fulfillment_provider = ${fulfillment.provider},
          fulfillment_reference = ${fulfillment.reference},
          updated_at = now()
      where id = ${order.id}::uuid
    `;

    return {
      orderNumber,
      accessToken: order.access_token == null ? "" : String(order.access_token),
      subtotalCents,
      shippingCents,
      taxCents,
      totalCents,
      persisted: "database",
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function upsertCustomerPhotoToStorage(
  sql: ReturnType<typeof createDb>,
  file: CreateOrderInput["photoFiles"][number],
): Promise<string> {
  const isDev = process.env.NODE_ENV !== "production";
  const bytes = decodeBase64(file.base64);
  if (!bytes.byteLength) {
    throw new OrderValidationError(`Photo "${file.fileName || file.photoNumber}" is empty.`);
  }

  const ext = file.mimeType.includes("png") ? "png" : "jpg";
  const storagePath = `customer-uploads/${file.photoId}/original.${ext}`;
  const previewPath = `customer-uploads/${file.photoId}/preview.${ext}`;

  if (isDev) {
    console.info("[upsertCustomerPhotoToStorage] starting upload", {
      photoNumber: file.photoNumber,
      mimeType: file.mimeType,
      byteLength: bytes.byteLength,
      storagePath,
      previewPath,
      key: describeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error: originalError } = await supabaseAdmin.storage
    .from("photo-originals")
    .upload(storagePath, bytes, { contentType: file.mimeType, upsert: true });
  if (originalError) {
    if (isDev) {
      console.error("[upsertCustomerPhotoToStorage] original upload failed", {
        bucket: "photo-originals",
        path: storagePath,
        message: originalError.message,
        name: originalError.name,
        status: (originalError as { status?: number; statusCode?: string }).status,
        statusCode: (originalError as { statusCode?: string }).statusCode,
      });
    } else {
      console.error("[upsertCustomerPhotoToStorage] original upload failed:", originalError.message);
    }
    throw new OrderValidationError(
      "We couldn't securely store your photos. Please try again in a moment.",
    );
  }
  if (isDev) console.info("[upsertCustomerPhotoToStorage] original upload ok", { storagePath });

  const { error: previewError } = await supabaseAdmin.storage
    .from("photo-previews")
    .upload(previewPath, bytes, { contentType: file.mimeType, upsert: true });
  if (previewError) {
    if (isDev) {
      console.error("[upsertCustomerPhotoToStorage] preview upload failed", {
        bucket: "photo-previews",
        path: previewPath,
        message: previewError.message,
        name: previewError.name,
        statusCode: (previewError as { statusCode?: string }).statusCode,
      });
    } else {
      console.error("[upsertCustomerPhotoToStorage] preview upload failed:", previewError.message);
    }
    // Best-effort cleanup of the original we just wrote so we don't leave orphans
    // for an order that will not be created.
    await supabaseAdmin.storage.from("photo-originals").remove([storagePath]);
    throw new OrderValidationError(
      "We couldn't securely store your photos. Please try again in a moment.",
    );
  }
  if (isDev) console.info("[upsertCustomerPhotoToStorage] preview upload ok", { previewPath });

  // Confirm the production original is actually retrievable before accepting the order.
  const { data: verified, error: verifyError } = await supabaseAdmin.storage
    .from("photo-originals")
    .createSignedUrl(storagePath, 60);
  if (verifyError || !verified?.signedUrl) {
    if (isDev) {
      console.error("[upsertCustomerPhotoToStorage] signed URL verify failed", {
        bucket: "photo-originals",
        path: storagePath,
        message: verifyError?.message ?? "missing signedUrl",
        statusCode: (verifyError as { statusCode?: string } | null)?.statusCode,
      });
    } else {
      console.error(
        "[upsertCustomerPhotoToStorage] original verify failed:",
        verifyError?.message ?? "missing signedUrl",
      );
    }
    throw new OrderValidationError(
      "We couldn't verify your photos were stored. Please try again in a moment.",
    );
  }
  if (isDev) console.info("[upsertCustomerPhotoToStorage] signed URL verify ok", { storagePath });

  const existing = await sql<{ id: string }[]>`
    select id from public.photos
    where event_id = ${CUSTOMER_UPLOAD_EVENT_ID}::uuid
      and photo_number = ${file.photoNumber}
    limit 1
  `;

  let photoId: string;
  if (existing[0]?.id) {
    photoId = existing[0].id;
    await sql`
      update public.photos
      set original_file_name = coalesce(${file.fileName}, original_file_name),
          original_path = ${storagePath},
          preview_url = ${previewPath},
          width = coalesce(${file.width || null}, width),
          height = coalesce(${file.height || null}, height),
          deleted_at = null
      where id = ${photoId}::uuid
    `;
  } else {
    const inserted = await sql<{ id: string }[]>`
      insert into public.photos (
        event_id, photo_number, preview_url, original_path, original_file_name, width, height
      ) values (
        ${CUSTOMER_UPLOAD_EVENT_ID}::uuid,
        ${file.photoNumber},
        ${previewPath},
        ${storagePath},
        ${file.fileName},
        ${file.width || null},
        ${file.height || null}
      )
      returning id
    `;
    photoId = inserted[0]!.id;
  }

  // New production flow is Storage-only. Drop any leftover legacy Postgres binary
  // for this photo so capacity is not wasted after a successful Storage write.
  await sql`delete from public.print_file_blobs where photo_id = ${photoId}::uuid`;

  const check = await sql<{ original_path: string | null; preview_url: string }[]>`
    select original_path, preview_url from public.photos where id = ${photoId}::uuid limit 1
  `;
  const row = check[0];
  if (
    !row?.original_path ||
    row.original_path.startsWith("blob://") ||
    row.original_path.startsWith("http://") ||
    row.original_path.startsWith("https://") ||
    !row.original_path.includes("customer-uploads/") ||
    !row.preview_url ||
    row.preview_url.startsWith("blob://")
  ) {
    throw new OrderValidationError(
      "We couldn't securely store your photos. Please try again in a moment.",
    );
  }

  return photoId;
}

export function buildLocalOrder(input: CreateOrderInput): CreateOrderResult {
  const orderNumber = String(Math.floor(10000 + Math.random() * 89999));
  const accessToken = crypto.randomUUID();
  const shippingCents = input.fulfillment === "studio_pickup" ? 0 : input.totals.shippingCents;
  const subtotalCents = input.totals.subtotalCents;
  const taxCents = input.totals.taxCents;
  const totalCents =
    input.fulfillment === "studio_pickup"
      ? subtotalCents + taxCents
      : input.totals.totalCents;
  return {
    orderNumber,
    accessToken,
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    persisted: "local",
  };
}
