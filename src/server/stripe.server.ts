import Stripe from "stripe";
import { createDb } from "@/server/db.server";

export function getStripeSecretKey(): string {
  return (
    process.env["STRIPE_SECRET_KEY"]?.trim() ||
    process.env["SECRET_KEY"]?.trim() ||
    ""
  );
}

export function getStripeWebhookSecret(): string {
  return process.env["STRIPE_WEBHOOK_SECRET"]?.trim() || "";
}

export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error("Stripe secret key is not configured.");
  }
  return new Stripe(key);
}

export function assertSafeCheckoutOrigin(origin: string): string {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("Invalid checkout origin.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid checkout origin.");
  }
  return parsed.origin;
}

export async function createOrderCheckoutSession(input: {
  orderId: string;
  orderNumber: string;
  accessToken: string;
  totalCents: number;
  customerEmail: string;
  origin: string;
}): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe();
  const origin = assertSafeCheckoutOrigin(input.origin);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.totalCents,
          product_data: {
            name: `Dynasty Pix order #${input.orderNumber}`,
            description: "Photographic prints",
          },
        },
      },
    ],
    metadata: {
      order_id: input.orderId,
      order_number: input.orderNumber,
      access_token: input.accessToken,
    },
    success_url: `${origin}/confirmation/${encodeURIComponent(input.orderNumber)}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?canceled=1`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return { sessionId: session.id, url: session.url };
}

/**
 * Idempotently mark an order paid after Stripe confirms payment, then queue fulfillment.
 */
export async function markOrderPaidFromStripe(input: {
  orderId?: string | null;
  orderNumber?: string | null;
  providerPaymentId: string;
  amountCents?: number | null;
}): Promise<{ orderNumber: string; alreadyPaid: boolean }> {
  const sql = createDb();
  try {
    const orders = await sql<
      {
        id: string;
        order_number: string;
        payment_status: string;
        fulfillment_method: "shipping" | "studio_pickup";
        shipping_method_code: string | null;
        fulfillment_reference: string | null;
        total_cents: number;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
      }[]
    >`
      select
        o.id,
        o.order_number,
        o.payment_status::text as payment_status,
        o.fulfillment_method,
        o.shipping_method_code,
        o.fulfillment_reference,
        o.total_cents,
        c.email,
        c.first_name,
        c.last_name
      from public.orders o
      left join public.customers c on c.id = o.customer_id
      where o.id = ${input.orderId ?? "00000000-0000-0000-0000-000000000000"}::uuid
         or o.order_number = ${input.orderNumber ?? ""}
      limit 1
    `;

    const order = orders.find((row) => {
      if (input.orderId && row.id === input.orderId) return true;
      if (input.orderNumber && row.order_number === input.orderNumber) return true;
      return false;
    });
    if (!order) {
      throw new Error("Order not found for Stripe payment.");
    }

    if (order.payment_status === "paid") {
      return { orderNumber: order.order_number, alreadyPaid: true };
    }

    const amount = input.amountCents ?? order.total_cents;

    await sql`
      update public.payments
      set
        provider = 'stripe',
        provider_payment_id = ${input.providerPaymentId},
        amount_cents = ${amount},
        status = 'paid'::public.payment_status
      where order_id = ${order.id}::uuid
    `;

    await sql`
      update public.orders
      set
        payment_status = 'paid'::public.payment_status,
        updated_at = now()
      where id = ${order.id}::uuid
    `;

    if (!order.fulfillment_reference) {
      const items = await sql<
        {
          photo_id: string;
          photo_number_snapshot: string;
          product_name_snapshot: string;
          size_label_snapshot: string;
          quantity: number;
          original_path: string | null;
        }[]
      >`
        select
          oi.photo_id,
          oi.photo_number_snapshot,
          oi.product_name_snapshot,
          oi.size_label_snapshot,
          oi.quantity,
          p.original_path
        from public.order_items oi
        left join public.photos p on p.id = oi.photo_id
        where oi.order_id = ${order.id}::uuid
      `;

      let shipTo: {
        name: string;
        addressLine1: string;
        addressLine2: string | null;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      } | null = null;

      if (order.fulfillment_method === "shipping") {
        const addresses = await sql<
          {
            first_name: string;
            last_name: string;
            address_line1: string;
            address_line2: string | null;
            city: string;
            state: string;
            postal_code: string;
            country: string;
          }[]
        >`
          select first_name, last_name, address_line1, address_line2, city, state, postal_code, country
          from public.shipping_addresses
          where order_id = ${order.id}::uuid
          limit 1
        `;
        const addr = addresses[0];
        if (addr) {
          shipTo = {
            name: `${addr.first_name} ${addr.last_name}`.trim(),
            addressLine1: addr.address_line1,
            addressLine2: addr.address_line2,
            city: addr.city,
            state: addr.state,
            postalCode: addr.postal_code,
            country: addr.country,
          };
        }
      }

      const { getFulfillmentProvider } = await import("@/lib/fulfillment.server");
      const fulfillment = await getFulfillmentProvider().submitOrder({
        orderNumber: order.order_number,
        fulfillmentMethod: order.fulfillment_method,
        shippingMethodCode: order.shipping_method_code,
        items: items.map((line) => ({
          photoId: line.photo_id,
          photoNumber: line.photo_number_snapshot,
          originalPath: line.original_path,
          productName: line.product_name_snapshot,
          sizeLabel: line.size_label_snapshot,
          quantity: line.quantity,
        })),
        shipTo,
      });

      await sql`
        update public.orders
        set
          fulfillment_provider = ${fulfillment.provider},
          fulfillment_reference = ${fulfillment.reference},
          updated_at = now()
        where id = ${order.id}::uuid
      `;
    }

    if (order.email) {
      const { sendEmail, orderConfirmationEmail } = await import("@/lib/email.server");
      const studios = await sql<{ pickup_note: string | null }[]>`
        select pickup_note from public.studio_settings limit 1
      `;
      await sendEmail(
        orderConfirmationEmail({
          to: order.email,
          firstName: order.first_name?.trim() || "there",
          orderNumber: order.order_number,
          totalCents: order.total_cents,
          fulfillmentMethod: order.fulfillment_method,
          pickupNote:
            studios[0]?.pickup_note?.trim() ||
            "We'll email you when your prints are ready for studio pickup.",
        }),
      );
    }

    return { orderNumber: order.order_number, alreadyPaid: false };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function confirmCheckoutSession(sessionId: string): Promise<{
  orderNumber: string;
  accessToken: string | null;
  paymentStatus: "paid" | "pending" | "failed";
}> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const orderId = session.metadata?.["order_id"] ?? null;
  const orderNumber = session.metadata?.["order_number"] ?? null;
  const accessToken = session.metadata?.["access_token"] ?? null;

  if (session.payment_status === "paid") {
    await markOrderPaidFromStripe({
      orderId,
      orderNumber,
      providerPaymentId: session.payment_intent
        ? String(session.payment_intent)
        : session.id,
      amountCents: session.amount_total,
    });
    return {
      orderNumber: orderNumber ?? "",
      accessToken,
      paymentStatus: "paid",
    };
  }

  if (session.status === "expired") {
    return {
      orderNumber: orderNumber ?? "",
      accessToken,
      paymentStatus: "failed",
    };
  }

  return {
    orderNumber: orderNumber ?? "",
    accessToken,
    paymentStatus: "pending",
  };
}
