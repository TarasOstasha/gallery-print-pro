import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin access required");
}

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const [orders, events, products] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, total_cents, fulfillment_method, payment_status, order_status, created_at, customers(first_name, last_name, email)",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("events")
        .select("id, slug, title, event_date, is_published, downloads_enabled, photos(count)")
        .order("sort_order", { ascending: true }),
      supabase
        .from("products")
        .select("id, name, category, is_active, product_variants(id, size_label, price_cents, is_active)")
        .order("sort_order", { ascending: true }),
    ]);

    return {
      orders: orders.data ?? [],
      events: events.data ?? [],
      products: products.data ?? [],
    };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; status: OrderStatus }) => {
    const allowed: OrderStatus[] = [
      "new",
      "processing",
      "sent_to_lab",
      "ready_for_pickup",
      "shipped",
      "completed",
      "cancelled",
    ];
    if (!input?.orderId || !allowed.includes(input.status)) throw new Error("Invalid status update");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const { error } = await supabase
      .from("orders")
      .update({ order_status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.orderId);
    if (error) throw error;

    if (data.status === "ready_for_pickup") {
      const { data: order } = await supabase
        .from("orders")
        .select("order_number, customers(first_name, email)")
        .eq("id", data.orderId)
        .maybeSingle();
      const { data: studio } = await supabase
        .from("studio_settings")
        .select("studio_name, address_line1, city, state, postal_code")
        .limit(1)
        .maybeSingle();
      if (order?.customers?.email) {
        const { sendEmail, readyForPickupEmail } = await import("./email.server");
        await sendEmail(
          readyForPickupEmail({
            to: order.customers.email,
            firstName: order.customers.first_name,
            orderNumber: order.order_number,
            studioAddress: studio
              ? `${studio.studio_name}, ${studio.address_line1}, ${studio.city}, ${studio.state} ${studio.postal_code}`
              : "our studio",
          }),
        );
      }
    }

    return { ok: true };
  });

export const setEventPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; isPublished: boolean }) => {
    if (!input?.eventId || typeof input.isPublished !== "boolean") throw new Error("Invalid input");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("events")
      .update({ is_published: data.isPublished })
      .eq("id", data.eventId);
    if (error) throw error;
    return { ok: true };
  });

export const setProductActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; isActive: boolean }) => {
    if (!input?.productId || typeof input.isActive !== "boolean") throw new Error("Invalid input");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("products")
      .update({ is_active: data.isActive })
      .eq("id", data.productId);
    if (error) throw error;
    return { ok: true };
  });

export const setVariantPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { variantId: string; priceCents: number }) => {
    if (!input?.variantId) throw new Error("Invalid variant");
    if (!Number.isInteger(input.priceCents) || input.priceCents < 0 || input.priceCents > 1000000) {
      throw new Error("Invalid price");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("product_variants")
      .update({ price_cents: data.priceCents })
      .eq("id", data.variantId);
    if (error) throw error;
    return { ok: true };
  });
