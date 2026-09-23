import { createDb, isServiceRoleKey } from "@/server/db.server";

export const CUSTOMER_UPLOAD_EVENT_ID = "33333333-3333-4333-8333-333333333333";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

export type CreateOrderInput = {
  fulfillment: "shipping" | "studio_pickup";
  shippingMethodCode: string | null;
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

/**
 * Persists an order using DATABASE_URL (trusted server).
 * Uploads originals to Storage when a real service_role key is configured;
 * otherwise stores file bytes in print_file_blobs for studio fulfillment.
 */
export async function createOrderInDatabase(input: CreateOrderInput): Promise<CreateOrderResult> {
  const sql = createDb();
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

    const variants = await sql<{
      id: string;
      size_label: string;
      price_cents: number;
    }[]>`
      select id, size_label, price_cents
      from public.product_variants
      where product_id = ${PRODUCT_ID}::uuid and is_active = true
      order by sort_order
    `;
    if (!variants.length) throw new Error("Print sizes are unavailable");

    const variantById = new Map(variants.map((v) => [v.id, v]));
    const variantByLabel = new Map(variants.map((v) => [v.size_label, v]));

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
      photoNumber: string;
      sizeLabel: string;
    }> = [];

    for (const item of input.items) {
      const variant =
        variantById.get(item.productVariantId) ?? variantByLabel.get(item.sizeLabel);
      if (!variant) throw new Error(`Unknown print size: ${item.sizeLabel}`);
      subtotalCents += variant.price_cents * item.quantity;
      lineItems.push({
        clientPhotoId: item.photoId,
        variantId: variant.id,
        quantity: item.quantity,
        unitPrice: variant.price_cents,
        photoNumber: item.photoNumber,
        sizeLabel: variant.size_label,
      });
    }

    const shippingCents =
      input.fulfillment === "shipping" && input.shippingMethodCode
        ? (shippingPrices.get(input.shippingMethodCode) ?? 0)
        : 0;
    const taxCents = Math.round((subtotalCents + shippingCents) * taxRate);
    const totalCents = subtotalCents + shippingCents + taxCents;

    const canUseStorage = isServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const photoIdMap = new Map<string, string>();

    for (const file of input.photoFiles) {
      const dbPhotoId = await upsertCustomerPhoto(sql, file, canUseStorage);
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

    const orderRows = await sql<{ id: string; access_token: string }[]>`
      insert into public.orders (
        order_number, customer_id, subtotal_cents, shipping_cents, tax_cents, total_cents,
        fulfillment_method, shipping_method_code, payment_status, order_status, fulfillment_provider
      ) values (
        ${orderNumber},
        ${customerId}::uuid,
        ${subtotalCents},
        ${shippingCents},
        ${taxCents},
        ${totalCents},
        ${input.fulfillment}::public.fulfillment_method,
        ${input.shippingMethodCode},
        'paid'::public.payment_status,
        'new'::public.order_status,
        'manual_studio'
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
          photo_number_snapshot, product_name_snapshot, size_label_snapshot
        ) values (
          ${order.id}::uuid,
          ${photoId}::uuid,
          ${line.variantId}::uuid,
          ${line.quantity},
          ${line.unitPrice},
          ${line.unitPrice * line.quantity},
          ${line.photoNumber},
          'Photographic Print',
          ${line.sizeLabel}
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
      shippingMethodCode: input.shippingMethodCode,
      items: lineItems.map((line) => ({
        photoId: photoIdMap.get(line.clientPhotoId)!,
        photoNumber: line.photoNumber,
        originalPath: null,
        productName: "Photographic Print",
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
      accessToken: order.access_token,
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

async function upsertCustomerPhoto(
  sql: ReturnType<typeof createDb>,
  file: CreateOrderInput["photoFiles"][number],
  canUseStorage: boolean,
): Promise<string> {
  const bytes = decodeBase64(file.base64);
  const ext = file.mimeType.includes("png") ? "png" : "jpg";
  const storagePath = `customer-uploads/${file.photoId}/original.${ext}`;
  const previewPath = `customer-uploads/${file.photoId}/preview.${ext}`;

  if (canUseStorage) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage
      .from("photo-originals")
      .upload(storagePath, bytes, { contentType: file.mimeType, upsert: true });
    await supabaseAdmin.storage
      .from("photo-previews")
      .upload(previewPath, bytes, { contentType: file.mimeType, upsert: true });
  }

  const existing = await sql<{ id: string }[]>`
    select id from public.photos
    where event_id = ${CUSTOMER_UPLOAD_EVENT_ID}::uuid
      and photo_number = ${file.photoNumber}
    limit 1
  `;
  if (existing[0]?.id) {
    await sql`
      insert into public.print_file_blobs (photo_id, mime_type, file_name, content)
      values (
        ${existing[0].id}::uuid,
        ${file.mimeType},
        ${file.fileName},
        ${bytes}
      )
      on conflict (photo_id) do update
      set mime_type = excluded.mime_type,
          file_name = excluded.file_name,
          content = excluded.content
    `;
    return existing[0].id;
  }

  const inserted = await sql<{ id: string }[]>`
    insert into public.photos (
      event_id, photo_number, preview_url, original_path, width, height
    ) values (
      ${CUSTOMER_UPLOAD_EVENT_ID}::uuid,
      ${file.photoNumber},
      ${canUseStorage ? previewPath : `blob://${file.photoId}`},
      ${canUseStorage ? storagePath : null},
      ${file.width || null},
      ${file.height || null}
    )
    returning id
  `;
  const photoId = inserted[0]!.id;

  await sql`
    insert into public.print_file_blobs (photo_id, mime_type, file_name, content)
    values (${photoId}::uuid, ${file.mimeType}, ${file.fileName}, ${bytes})
    on conflict (photo_id) do update
    set mime_type = excluded.mime_type,
        file_name = excluded.file_name,
        content = excluded.content
  `;

  return photoId;
}

export function buildLocalOrder(input: CreateOrderInput): CreateOrderResult {
  const orderNumber = String(Math.floor(10000 + Math.random() * 89999));
  const accessToken = crypto.randomUUID();
  return {
    orderNumber,
    accessToken,
    ...input.totals,
    persisted: "local",
  };
}
