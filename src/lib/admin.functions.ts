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
          `
          id, order_number, total_cents, fulfillment_method, payment_status, order_status, created_at,
          customers(first_name, last_name, email),
          order_items(
            id,
            photo_id,
            photos(deleted_at, original_path, preview_url, event_id)
          )
        `,
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

    const { classifyPhotoStorage, CUSTOMER_UPLOAD_EVENT_ID } = await import(
      "@/server/photo-storage.server"
    );

    const ordersWithPhotoStatus = (orders.data ?? []).map((order) => {
      const items = order.order_items ?? [];
      let stored = 0;
      let removed = 0;
      for (const item of items) {
        const photo = Array.isArray(item.photos) ? item.photos[0] : item.photos;
        if (!photo || photo.event_id !== CUSTOMER_UPLOAD_EVENT_ID) continue;
        const status = classifyPhotoStorage({
          deletedAt: photo.deleted_at,
          originalPath: photo.original_path,
          previewUrl: photo.preview_url,
        });
        if (status === "available") stored += 1;
        else if (status === "deleted") removed += 1;
      }
      const photosStatus: "stored" | "removed" | "none" =
        stored > 0 ? "stored" : removed > 0 ? "removed" : "none";
      const { order_items: _omit, ...rest } = order;
      return { ...rest, photosStatus };
    });

    return {
      orders: ordersWithPhotoStatus,
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
      if (order?.customers) {
        const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
        if (customer?.email) {
          const { sendEmail, readyForPickupEmail } = await import("./email.server");
          await sendEmail(
            readyForPickupEmail({
              to: customer.email,
              firstName: customer.first_name,
              orderNumber: order.order_number,
              studioAddress: studio
                ? `${studio.studio_name}, ${studio.address_line1}, ${studio.city}, ${studio.state} ${studio.postal_code}`
                : "our studio",
            }),
          );
        }
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

export type AdminOrderDetail = {
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    orderStatus: OrderStatus;
    paymentStatus: string;
    fulfillmentMethod: "shipping" | "studio_pickup";
    shippingMethodCode: string | null;
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
  };
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null;
  shippingAddress: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  shippingMethodName: string | null;
  photoSummary: {
    storedUniqueCount: number;
    deletedUniqueCount: number;
    deletableUniqueCount: number;
  };
  items: Array<{
    id: string;
    photoId: string | null;
    photoNumber: string;
    fileName: string | null;
    previewUrl: string | null;
    photoStatus: "available" | "deleted" | "none";
    photoDeletedAt: string | null;
    canDownloadOriginal: boolean;
    canDeleteStoredPhoto: boolean;
    productName: string;
    finish: string | null;
    sizeLabel: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    hasBorder: boolean;
    mountingCode: string;
    mountingPriceCents: number;
    printPriceCents: number | null;
    cropX: number;
    cropY: number;
    productNameSnapshot: string;
  }>;
};

export const getAdminOrderDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderNumber: string }) => {
    const orderNumber = String(input?.orderNumber ?? "").trim();
    if (!orderNumber) throw new Error("Order number required");
    return { orderNumber };
  })
  .handler(async ({ data, context }): Promise<AdminOrderDetail> => {
    await assertAdmin(context);
    const { supabase } = context;
    const {
      classifyPhotoStorage,
      findBlockingOrderNumbers,
    } = await import("@/server/photo-storage.server");

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        order_number,
        created_at,
        order_status,
        payment_status,
        fulfillment_method,
        shipping_method_code,
        subtotal_cents,
        shipping_cents,
        tax_cents,
        total_cents,
        customers(first_name, last_name, email, phone),
        shipping_addresses(
          first_name, last_name, email, phone,
          address_line1, address_line2, city, state, postal_code, country
        ),
        order_items(
          id,
          quantity,
          unit_price_cents,
          line_total_cents,
          photo_number_snapshot,
          product_name_snapshot,
          size_label_snapshot,
          has_border,
          mounting_code,
          mounting_price_cents,
          print_price_cents,
          crop_x,
          crop_y,
          photo_id,
          product_variant_id,
          photos(
            id, preview_url, photo_number, original_path, original_file_name,
            deleted_at, created_at, event_id
          ),
          product_variants(finish, size_label, products(name))
        )
      `,
      )
      .eq("order_number", data.orderNumber)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) throw new Error("Order not found");

    let shippingMethodName: string | null = null;
    if (order.shipping_method_code) {
      const { data: method } = await supabase
        .from("shipping_methods")
        .select("name")
        .eq("code", order.shipping_method_code)
        .maybeSingle();
      shippingMethodName = method?.name ?? order.shipping_method_code;
    }

    const rawItems = order.order_items ?? [];
    const uniquePhotoIds = [
      ...new Set(rawItems.map((i) => i.photo_id).filter((id): id is string => Boolean(id))),
    ];
    const blockingByPhoto = new Map<string, string[]>();
    await Promise.all(
      uniquePhotoIds.map(async (photoId) => {
        const blocking = await findBlockingOrderNumbers(supabase, photoId, order.id);
        blockingByPhoto.set(photoId, blocking);
      }),
    );

    const items = await Promise.all(
      rawItems.map(async (item) => {
        const photo = Array.isArray(item.photos) ? item.photos[0] : item.photos;
        const variant = Array.isArray(item.product_variants)
          ? item.product_variants[0]
          : item.product_variants;
        const product = variant
          ? Array.isArray(variant.products)
            ? variant.products[0]
            : variant.products
          : null;

        const photoStatus = classifyPhotoStorage(
          photo
            ? {
                deletedAt: photo.deleted_at,
                originalPath: photo.original_path,
                previewUrl: photo.preview_url,
              }
            : null,
        );

        let previewUrl: string | null = null;
        if (photoStatus === "available") {
          const rawPreview = photo?.preview_url ?? null;
          if (rawPreview) {
            if (rawPreview.startsWith("http://") || rawPreview.startsWith("https://")) {
              previewUrl = rawPreview;
            } else if (!rawPreview.startsWith("blob://") && !rawPreview.startsWith("deleted://")) {
              const { data: signed } = await supabase.storage
                .from("photo-previews")
                .createSignedUrl(rawPreview, 60 * 60);
              previewUrl = signed?.signedUrl ?? null;
            }
          }
        }

        const canDownloadOriginal = photoStatus === "available";
        const blocking = item.photo_id ? (blockingByPhoto.get(item.photo_id) ?? []) : [];
        const canDeleteStoredPhoto = photoStatus === "available" && blocking.length === 0;

        return {
          id: item.id,
          photoId: item.photo_id,
          photoNumber: item.photo_number_snapshot,
          fileName: photo?.original_file_name ?? item.photo_number_snapshot,
          previewUrl,
          photoStatus,
          photoDeletedAt: photo?.deleted_at ?? null,
          canDownloadOriginal,
          canDeleteStoredPhoto,
          productName: product?.name ?? item.product_name_snapshot,
          finish: variant?.finish ?? null,
          sizeLabel: item.size_label_snapshot,
          quantity: item.quantity,
          unitPriceCents: item.unit_price_cents,
          lineTotalCents: item.line_total_cents,
          hasBorder: Boolean(item.has_border),
          mountingCode: item.mounting_code,
          mountingPriceCents: item.mounting_price_cents ?? 0,
          printPriceCents: item.print_price_cents,
          cropX: typeof item.crop_x === "number" ? item.crop_x : 50,
          cropY: typeof item.crop_y === "number" ? item.crop_y : 50,
          productNameSnapshot: item.product_name_snapshot,
        };
      }),
    );

    const seen = new Set<string>();
    let storedUniqueCount = 0;
    let deletedUniqueCount = 0;
    let deletableUniqueCount = 0;
    for (const item of items) {
      if (!item.photoId || seen.has(item.photoId)) continue;
      seen.add(item.photoId);
      if (item.photoStatus === "available") {
        storedUniqueCount += 1;
        if (item.canDeleteStoredPhoto) deletableUniqueCount += 1;
      } else if (item.photoStatus === "deleted") {
        deletedUniqueCount += 1;
      }
    }

    const customerRaw = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    const addressRaw = Array.isArray(order.shipping_addresses)
      ? order.shipping_addresses[0]
      : order.shipping_addresses;

    return {
      order: {
        id: order.id,
        orderNumber: order.order_number,
        createdAt: order.created_at,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        fulfillmentMethod: order.fulfillment_method,
        shippingMethodCode: order.shipping_method_code,
        subtotalCents: order.subtotal_cents,
        shippingCents: order.shipping_cents,
        taxCents: order.tax_cents,
        totalCents: order.total_cents,
      },
      customer: customerRaw
        ? {
            firstName: customerRaw.first_name,
            lastName: customerRaw.last_name,
            email: customerRaw.email,
            phone: customerRaw.phone,
          }
        : null,
      shippingAddress: addressRaw
        ? {
            firstName: addressRaw.first_name,
            lastName: addressRaw.last_name,
            email: addressRaw.email,
            phone: addressRaw.phone,
            addressLine1: addressRaw.address_line1,
            addressLine2: addressRaw.address_line2,
            city: addressRaw.city,
            state: addressRaw.state,
            postalCode: addressRaw.postal_code,
            country: addressRaw.country,
          }
        : null,
      shippingMethodName,
      photoSummary: { storedUniqueCount, deletedUniqueCount, deletableUniqueCount },
      items,
    };
  });

export const getAdminPhotoDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; photoId: string }) => {
    if (!input?.orderId || !input?.photoId) throw new Error("orderId and photoId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { createOriginalDownloadUrl } = await import("@/server/photo-storage.server");
    return createOriginalDownloadUrl({
      supabase: context.supabase,
      orderId: data.orderId,
      photoId: data.photoId,
    });
  });

export const deleteAdminStoredPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; photoId: string }) => {
    if (!input?.orderId || !input?.photoId) throw new Error("orderId and photoId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: membership, error: membershipError } = await context.supabase
      .from("order_items")
      .select("id")
      .eq("order_id", data.orderId)
      .eq("photo_id", data.photoId)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) throw new Error("Photo does not belong to this order");

    const { deletePhotoAssetsForOrder } = await import("@/server/photo-storage.server");
    const result = await deletePhotoAssetsForOrder({
      supabase: context.supabase,
      orderId: data.orderId,
      photoId: data.photoId,
    });

    if (result.status === "skipped_shared") {
      throw new Error(result.warnings[0] ?? "Photo is still used by another order");
    }
    if (result.status === "no_stored_photo") {
      throw new Error("No stored photo to delete");
    }
    if (result.warnings.length > 0 && result.status === "deleted") {
      return { ...result, partial: true as const };
    }
    return { ...result, partial: false as const };
  });

export const deleteAdminOrderPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => {
    if (!input?.orderId) throw new Error("orderId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: items, error } = await context.supabase
      .from("order_items")
      .select("photo_id")
      .eq("order_id", data.orderId);
    if (error) throw error;

    const uniquePhotoIds = [
      ...new Set((items ?? []).map((i) => i.photo_id).filter((id): id is string => Boolean(id))),
    ];

    const { deletePhotoAssetsForOrder } = await import("@/server/photo-storage.server");
    const results = [];
    for (const photoId of uniquePhotoIds) {
      results.push(
        await deletePhotoAssetsForOrder({
          supabase: context.supabase,
          orderId: data.orderId,
          photoId,
        }),
      );
    }

    return {
      attempted: uniquePhotoIds.length,
      deleted: results.filter((r) => r.status === "deleted").length,
      alreadyDeleted: results.filter((r) => r.status === "already_deleted").length,
      skippedShared: results.filter((r) => r.status === "skipped_shared").length,
      noStoredPhoto: results.filter((r) => r.status === "no_stored_photo").length,
      warnings: results.flatMap((r) => r.warnings),
      results,
    };
  });

export const listAdminRetentionEligiblePhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getPhotoRetentionDays, listRetentionEligiblePhotoIds } = await import(
      "@/server/photo-storage.server"
    );
    const eligible = await listRetentionEligiblePhotoIds(context.supabase);
    return {
      retentionDays: getPhotoRetentionDays(),
      eligibleCount: eligible.length,
      eligible,
    };
  });
