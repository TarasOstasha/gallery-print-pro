import { createServerFn } from "@tanstack/react-start";

export type PlaceOrderInput = {
  items: Array<{ photoId: string; productVariantId: string; quantity: number }>;
  fulfillmentMethod: "shipping" | "studio_pickup";
  shippingMethodCode: string | null;
  customer: { firstName: string; lastName: string; email: string; phone: string | null };
  address: {
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  customerNote: string | null;
};

function validate(input: PlaceOrderInput): PlaceOrderInput {
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("Cart is empty");
  if (input.items.length > 100) throw new Error("Too many items");
  for (const item of input.items) {
    if (!item.photoId || !item.productVariantId) throw new Error("Invalid cart item");
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new Error("Invalid quantity");
    }
  }
  if (input.fulfillmentMethod !== "shipping" && input.fulfillmentMethod !== "studio_pickup") {
    throw new Error("Invalid fulfillment method");
  }
  const c = input.customer;
  if (!c?.firstName?.trim() || !c?.lastName?.trim()) throw new Error("Name is required");
  if (!c?.email?.includes("@")) throw new Error("A valid email is required");
  if (input.fulfillmentMethod === "shipping") {
    const a = input.address;
    if (!a?.addressLine1?.trim() || !a?.city?.trim() || !a?.state?.trim() || !a?.postalCode?.trim()) {
      throw new Error("A complete shipping address is required");
    }
    if (!input.shippingMethodCode) throw new Error("Select a shipping method");
  }
  return input;
}

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: PlaceOrderInput) => validate(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getFulfillmentProvider } = await import("./fulfillment.server");
    const { sendEmail, orderConfirmationEmail } = await import("./email.server");

    const photoIds = [...new Set(data.items.map((item) => item.photoId))];
    const variantIds = [...new Set(data.items.map((item) => item.productVariantId))];

    const [photosRes, variantsRes, studioRes] = await Promise.all([
      supabaseAdmin
        .from("photos")
        .select("id, photo_number, original_path, event_id, events!inner(is_published)")
        .in("id", photoIds),
      supabaseAdmin
        .from("product_variants")
        .select("id, size_label, price_cents, is_active, products!inner(name, is_active)")
        .in("id", variantIds),
      supabaseAdmin.from("studio_settings").select("*").limit(1).maybeSingle(),
    ]);

    const photos = new Map((photosRes.data ?? []).map((row) => [row.id, row]));
    const variants = new Map((variantsRes.data ?? []).map((row) => [row.id, row]));
    const studio = studioRes.data;
    if (!studio) throw new Error("Studio settings are not configured");

    // Server-side pricing: never trust client amounts.
    const lines = data.items.map((item) => {
      const photo = photos.get(item.photoId);
      const variant = variants.get(item.productVariantId);
      if (!photo || !photo.events?.is_published) throw new Error("A selected photograph is unavailable");
      if (!variant || !variant.is_active || !variant.products?.is_active) {
        throw new Error("A selected print size is unavailable");
      }
      return {
        photoId: photo.id,
        photoNumber: photo.photo_number,
        originalPath: photo.original_path,
        productVariantId: variant.id,
        productName: variant.products.name,
        sizeLabel: variant.size_label,
        quantity: item.quantity,
        unitPriceCents: variant.price_cents,
        lineTotalCents: variant.price_cents * item.quantity,
      };
    });

    const subtotalCents = lines.reduce((total, line) => total + line.lineTotalCents, 0);

    let shippingCents = 0;
    if (data.fulfillmentMethod === "shipping") {
      const { data: method } = await supabaseAdmin
        .from("shipping_methods")
        .select("price_cents")
        .eq("code", data.shippingMethodCode!)
        .eq("is_active", true)
        .maybeSingle();
      if (!method) throw new Error("Selected shipping method is unavailable");
      shippingCents = method.price_cents;
    }

    const taxCents = Math.round((subtotalCents + shippingCents) * Number(studio.tax_rate));
    const totalCents = subtotalCents + shippingCents + taxCents;

    const email = data.customer.email.trim().toLowerCase();
    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let customerId = existingCustomer?.id;
    if (!customerId) {
      const { data: created, error } = await supabaseAdmin
        .from("customers")
        .insert({
          email,
          first_name: data.customer.firstName.trim(),
          last_name: data.customer.lastName.trim(),
          phone: data.customer.phone?.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      customerId = created.id;
    }

    const { data: orderNumberData, error: numberError } =
      await supabaseAdmin.rpc("next_order_number");
    if (numberError) throw numberError;
    const orderNumber = String(orderNumberData);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        tax_cents: taxCents,
        total_cents: totalCents,
        fulfillment_method: data.fulfillmentMethod,
        shipping_method_code: data.fulfillmentMethod === "shipping" ? data.shippingMethodCode : null,
        customer_note: data.customerNote?.trim() || null,
      })
      .select("id, order_number, access_token")
      .single();
    if (orderError) throw orderError;

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
      lines.map((line) => ({
        order_id: order.id,
        photo_id: line.photoId,
        product_variant_id: line.productVariantId,
        quantity: line.quantity,
        unit_price_cents: line.unitPriceCents,
        line_total_cents: line.lineTotalCents,
        photo_number_snapshot: line.photoNumber,
        product_name_snapshot: line.productName,
        size_label_snapshot: line.sizeLabel,
      })),
    );
    if (itemsError) throw itemsError;

    if (data.fulfillmentMethod === "shipping" && data.address) {
      const { error: addressError } = await supabaseAdmin.from("shipping_addresses").insert({
        order_id: order.id,
        first_name: data.customer.firstName.trim(),
        last_name: data.customer.lastName.trim(),
        email,
        phone: data.customer.phone?.trim() || null,
        address_line1: data.address.addressLine1.trim(),
        address_line2: data.address.addressLine2?.trim() || null,
        city: data.address.city.trim(),
        state: data.address.state.trim(),
        postal_code: data.address.postalCode.trim(),
        country: data.address.country?.trim() || "United States",
      });
      if (addressError) throw addressError;
    }

    // Payment: provider-agnostic record. A Stripe PaymentIntent id drops into
    // provider/provider_payment_id later; no card data is ever stored here.
    await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      provider: "mock",
      provider_payment_id: `mock_${order.order_number}`,
      amount_cents: totalCents,
      status: "paid",
    });
    await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid", updated_at: new Date().toISOString() })
      .eq("id", order.id);

    const fulfillment = await getFulfillmentProvider().submitOrder({
      orderNumber: order.order_number,
      fulfillmentMethod: data.fulfillmentMethod,
      shippingMethodCode: data.shippingMethodCode,
      items: lines.map((line) => ({
        photoId: line.photoId,
        photoNumber: line.photoNumber,
        originalPath: line.originalPath,
        productName: line.productName,
        sizeLabel: line.sizeLabel,
        quantity: line.quantity,
      })),
      shipTo:
        data.fulfillmentMethod === "shipping" && data.address
          ? {
              name: `${data.customer.firstName} ${data.customer.lastName}`.trim(),
              addressLine1: data.address.addressLine1,
              addressLine2: data.address.addressLine2,
              city: data.address.city,
              state: data.address.state,
              postalCode: data.address.postalCode,
              country: data.address.country || "United States",
            }
          : null,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        fulfillment_provider: fulfillment.provider,
        fulfillment_reference: fulfillment.reference,
      })
      .eq("id", order.id);

    await sendEmail(
      orderConfirmationEmail({
        to: email,
        firstName: data.customer.firstName.trim(),
        orderNumber: order.order_number,
        totalCents,
        fulfillmentMethod: data.fulfillmentMethod,
        pickupNote: studio.pickup_note,
      }),
    );

    return { orderNumber: order.order_number, accessToken: order.access_token };
  });

export const getOrderReceipt = createServerFn({ method: "GET" })
  .inputValidator((input: { orderNumber: string; accessToken: string }) => {
    if (!input?.orderNumber || !input?.accessToken) throw new Error("Order not found");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number, subtotal_cents, shipping_cents, tax_cents, total_cents, fulfillment_method, shipping_method_code, payment_status, order_status, created_at, customers(first_name, last_name, email), order_items(photo_number_snapshot, product_name_snapshot, size_label_snapshot, quantity, unit_price_cents, line_total_cents), shipping_addresses(first_name, last_name, address_line1, address_line2, city, state, postal_code, country)",
      )
      .eq("order_number", data.orderNumber)
      .eq("access_token", data.accessToken)
      .maybeSingle();

    if (!order) throw new Error("Order not found");

    const { data: studio } = await supabaseAdmin
      .from("studio_settings")
      .select("studio_name, address_line1, address_line2, city, state, postal_code, country, pickup_note")
      .limit(1)
      .maybeSingle();

    return { order, studio };
  });
