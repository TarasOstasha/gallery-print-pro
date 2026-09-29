import { createFileRoute } from "@tanstack/react-router";
import {
  getStripe,
  getStripeWebhookSecret,
  markOrderPaidFromStripe,
} from "@/server/stripe.server";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = getStripeWebhookSecret();
        if (!webhookSecret) {
          console.error("[stripe.webhook] STRIPE_WEBHOOK_SECRET is not configured");
          return new Response("Webhook secret not configured", { status: 500 });
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return new Response("Missing stripe-signature", { status: 400 });
        }

        const payload = await request.text();
        const stripe = getStripe();

        let event;
        try {
          event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        } catch (err) {
          console.error("[stripe.webhook] signature verification failed", err);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          if (
            event.type === "checkout.session.completed" ||
            event.type === "checkout.session.async_payment_succeeded"
          ) {
            const session = event.data.object;
            if (session.payment_status === "paid" || event.type === "checkout.session.async_payment_succeeded") {
              await markOrderPaidFromStripe({
                orderId: session.metadata?.["order_id"] ?? null,
                orderNumber: session.metadata?.["order_number"] ?? null,
                providerPaymentId: session.payment_intent
                  ? String(session.payment_intent)
                  : session.id,
                amountCents: session.amount_total,
              });
            }
          }
        } catch (err) {
          console.error("[stripe.webhook] handler failed", err);
          return new Response("Webhook handler failed", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
