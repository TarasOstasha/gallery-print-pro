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

export async function createOrderInDatabase(input: CreateOrderInput): Promise<CreateOrderResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: variants, error: variantError } = await supabaseAdmin
    .from("product_variants")
    .select("id, size_label, price_cents")
    .eq("product_id", PRODUCT_ID)
    .eq("is_active", true);

  if (variantError || !variants?.length) {
    throw new Error("Print sizes are unavailable");
  }

  const variantById = new Map(variants.map((v) => [v.id, v]));
  const variantByLabel = new Map(variants.map((v) => [v.size_label, v]));

  const { data: shippingRows } = await supabaseAdmin
    .from("shipping_methods")
    .select("code, price_cents")
    .eq("is_active", true);
  const shippingPrices = new Map((shippingRows ?? []).map((r) => [r.code, r.price_cents]));

  const { data: studioRow } = await supabaseAdmin
    .from("studio_settings")
    .select("tax_rate")
    .limit(1)
    .maybeSingle();
  const taxRate = studioRow?.tax_rate ? Number(studioRow.tax_rate) : 0.08;

  let subtotalCents = 0;
  const lineItems: Array<{
    photoId: string;
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
    const unitPrice = variant.price_cents;
    subtotalCents += unitPrice * item.quantity;
    lineItems.push({
      photoId: item.photoId,
      variantId: variant.id,
      quantity: item.quantity,
      unitPrice,
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

  await ensureCustomerUploadEvent(supabaseAdmin);

  const photoIdMap = new Map<string, string>();
  for (const file of input.photoFiles) {
    const dbPhotoId = await upsertCustomerPhoto(supabaseAdmin, file);
    photoIdMap.set(file.photoId, dbPhotoId);
  }

  const { data: customerRow, error: customerError } = await supabaseAdmin
    .from("customers")
    .insert({
      email: input.customer.email,
      first_name: input.customer.firstName,
      last_name: input.customer.lastName,
      phone: input.customer.phone || null,
    })
    .select("id")
    .single();
  if (customerError) throw customerError;

  const { data: orderNumber, error: seqError } = await supabaseAdmin.rpc("next_order_number");
  if (seqError || !orderNumber) throw seqError ?? new Error("Could not assign order number");

  const { error: orderError } = await supabaseAdmin.from("orders").insert({
    order_number: orderNumber,
    customer_id: customerRow.id,
    subtotal_cents: subtotalCents,
    shipping_cents: shippingCents,
    tax_cents: taxCents,
    total_cents: totalCents,
    fulfillment_method: input.fulfillment,
    shipping_method_code: input.shippingMethodCode,
    payment_status: "paid",
    order_status: "new",
    fulfillment_provider: "manual_studio",
  });
  if (orderError) throw orderError;

  const { data: insertedOrder, error: fetchOrderError } = await supabaseAdmin
    .from("orders")
    .select("id, access_token")
    .eq("order_number", orderNumber)
    .single();
  if (fetchOrderError || !insertedOrder) throw fetchOrderError ?? new Error("Order missing");

  const itemsPayload = lineItems.map((line) => ({
    order_id: insertedOrder.id,
    photo_id: photoIdMap.get(line.photoId)!,
    product_variant_id: line.variantId,
    quantity: line.quantity,
    unit_price_cents: line.unitPrice,
    line_total_cents: line.unitPrice * line.quantity,
    photo_number_snapshot: line.photoNumber,
    product_name_snapshot: "Photographic Print",
    size_label_snapshot: line.sizeLabel,
  }));

  const { error: itemsError } = await supabaseAdmin.from("order_items").insert(itemsPayload);
  if (itemsError) throw itemsError;

  if (input.fulfillment === "shipping" && input.shippingAddress) {
    const addr = input.shippingAddress;
    await supabaseAdmin.from("shipping_addresses").insert({
      order_id: insertedOrder.id,
      first_name: input.customer.firstName,
      last_name: input.customer.lastName,
      email: input.customer.email,
      phone: input.customer.phone || null,
      address_line1: addr.address,
      address_line2: addr.apartment || null,
      city: addr.city,
      state: addr.state,
      postal_code: addr.zip,
      country: addr.country,
    });
  }

  await supabaseAdmin.from("payments").insert({
    order_id: insertedOrder.id,
    provider: "mock",
    amount_cents: totalCents,
    status: "paid",
  });

  return {
    orderNumber,
    accessToken: insertedOrder.access_token,
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    persisted: "database",
  };
}

async function ensureCustomerUploadEvent(
  supabaseAdmin: Awaited<ReturnType<typeof import("@/integrations/supabase/client.server")>>["supabaseAdmin"],
) {
  const { data } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", CUSTOMER_UPLOAD_EVENT_ID)
    .maybeSingle();
  if (data) return;
  await supabaseAdmin.from("events").insert({
    id: CUSTOMER_UPLOAD_EVENT_ID,
    slug: "customer-uploads",
    title: "Customer uploads",
    description: "Photos uploaded by customers for print orders.",
    is_published: false,
    downloads_enabled: false,
    sort_order: 99,
  });
}

async function upsertCustomerPhoto(
  supabaseAdmin: Awaited<ReturnType<typeof import("@/integrations/supabase/client.server")>>["supabaseAdmin"],
  file: CreateOrderInput["photoFiles"][number],
): Promise<string> {
  const bytes = decodeBase64(file.base64);
  const ext = file.mimeType.includes("png") ? "png" : "jpg";
  const storagePath = `customer-uploads/${file.photoId}/original.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("photo-originals")
    .upload(storagePath, bytes, { contentType: file.mimeType, upsert: true });
  if (uploadError) throw uploadError;

  const previewPath = `customer-uploads/${file.photoId}/preview.${ext}`;
  await supabaseAdmin.storage
    .from("photo-previews")
    .upload(previewPath, bytes, { contentType: file.mimeType, upsert: true });

  const { data: existing } = await supabaseAdmin
    .from("photos")
    .select("id")
    .eq("event_id", CUSTOMER_UPLOAD_EVENT_ID)
    .eq("photo_number", file.photoNumber)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: row, error } = await supabaseAdmin
    .from("photos")
    .insert({
      event_id: CUSTOMER_UPLOAD_EVENT_ID,
      photo_number: file.photoNumber,
      preview_url: previewPath,
      original_path: storagePath,
      width: file.width,
      height: file.height,
    })
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
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
