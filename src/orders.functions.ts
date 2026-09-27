import { createServerFn } from "@tanstack/react-start";
import { shippingMethods } from "@/lib/catalog";
import { createDb } from "@/server/db.server";
import type { CreateOrderInput, CreateOrderResult } from "@/server/orders.server";
import {
  assertMinimumMerchandiseSubtotal,
  assertOrderRequestGates,
  buildLocalOrder,
  createOrderInDatabase,
  isOrderValidationError,
  merchandiseSubtotalFromCatalog,
  OrderValidationError,
} from "@/server/orders.server";

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV !== "production";
}

const LOCAL_FALLBACK_SHIPPING_CODES = new Set(shippingMethods.map((m) => m.code));

export const placeOrder = createServerFn({ method: "POST" })
  .validator((data: CreateOrderInput) => data)
  .handler(async ({ data }): Promise<CreateOrderResult> => {
    try {
      return await createOrderInDatabase(data);
    } catch (error) {
      // Validation failures must never create a local/demo order.
      if (isOrderValidationError(error)) throw error;

      console.error("[placeOrder] Database order failed:", error);

      // Local fallback is development-only. Production must fail visibly.
      if (!isDevelopmentMode()) {
        throw new Error("Could not place order. Try again.");
      }

      assertOrderRequestGates(data);
      const catalogSubtotal = merchandiseSubtotalFromCatalog(data.items);
      assertMinimumMerchandiseSubtotal(catalogSubtotal);

      if (data.fulfillment === "shipping") {
        if (!data.shippingMethodCode || !LOCAL_FALLBACK_SHIPPING_CODES.has(data.shippingMethodCode)) {
          throw new OrderValidationError("Invalid shipping method.");
        }
      }

      const shippingCents = data.fulfillment === "studio_pickup" ? 0 : data.totals.shippingCents;
      const taxCents = Math.round((catalogSubtotal + shippingCents) * 0.08);
      return buildLocalOrder({
        ...data,
        totals: {
          subtotalCents: catalogSubtotal,
          shippingCents,
          taxCents,
          totalCents: catalogSubtotal + shippingCents + taxCents,
        },
      });
    }
  });

export type OrderReceipt = {
  orderNumber: string;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  fulfillmentMethod: "shipping" | "studio_pickup";
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  shippingAddress: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
};

/**
 * Secure customer receipt lookup.
 * Requires BOTH orderNumber and accessToken — never order number alone.
 * Uses the same DATABASE_URL path as order creation (not Admin API).
 */
export const getOrderReceipt = createServerFn({ method: "POST" })
  .validator((data: { orderNumber: string; accessToken: string }) => {
    const orderNumber = String(data?.orderNumber ?? "").trim();
    const accessToken = String(data?.accessToken ?? "").trim();
    if (!orderNumber || !accessToken) {
      throw new Error("Order not found");
    }
    return { orderNumber, accessToken };
  })
  .handler(async ({ data }): Promise<OrderReceipt> => {
    const sql = createDb();
    try {
      const rows = await sql<
        {
          order_number: string;
          total_cents: number;
          subtotal_cents: number;
          shipping_cents: number;
          tax_cents: number;
          fulfillment_method: "shipping" | "studio_pickup";
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          ship_first_name: string | null;
          ship_last_name: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
        }[]
      >`
        select
          o.order_number,
          o.total_cents,
          o.subtotal_cents,
          o.shipping_cents,
          o.tax_cents,
          o.fulfillment_method,
          c.email,
          c.first_name,
          c.last_name,
          sa.first_name as ship_first_name,
          sa.last_name as ship_last_name,
          sa.address_line1,
          sa.address_line2,
          sa.city,
          sa.state,
          sa.postal_code,
          sa.country
        from public.orders o
        left join public.customers c on c.id = o.customer_id
        left join public.shipping_addresses sa on sa.order_id = o.id
        where o.order_number = ${data.orderNumber}
          and o.access_token = ${data.accessToken}::uuid
        limit 1
      `;

      const row = rows[0];
      if (!row) {
        throw new Error("Order not found");
      }

      return {
        orderNumber: String(row.order_number),
        totalCents: row.total_cents,
        subtotalCents: row.subtotal_cents,
        shippingCents: row.shipping_cents,
        taxCents: row.tax_cents,
        fulfillmentMethod: row.fulfillment_method,
        customerEmail: row.email,
        customerFirstName: row.first_name,
        customerLastName: row.last_name,
        shippingAddress:
          row.address_line1 && row.ship_first_name
            ? {
                firstName: row.ship_first_name,
                lastName: row.ship_last_name ?? "",
                addressLine1: row.address_line1,
                addressLine2: row.address_line2,
                city: row.city ?? "",
                state: row.state ?? "",
                postalCode: row.postal_code ?? "",
                country: row.country ?? "",
              }
            : null,
      };
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
