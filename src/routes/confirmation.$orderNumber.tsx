import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { studio } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { confirmStripeCheckout, getOrderReceipt } from "@/orders.functions";

export const Route = createFileRoute("/confirmation/$orderNumber")({ component: Confirmation });

type StoredOrder = {
  number?: string;
  accessToken?: string;
  fulfillment: "shipping" | "studio_pickup";
  total: number;
  subtotal?: number;
  shipping?: number;
  tax?: number;
  persisted?: "database" | "local";
  data: Record<string, string>;
};

type ConfirmedTotals = {
  orderNumber: string;
  totalCents: number;
  fulfillment: "shipping" | "studio_pickup";
  email?: string;
  shippingName?: string;
  shippingLines?: string[];
  fromDatabase: boolean;
};

function Confirmation() {
  const { orderNumber: orderNumberParam } = Route.useParams();
  const orderNumber = String(orderNumberParam);
  const [confirmed, setConfirmed] = useState<ConfirmedTotals | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let stored: StoredOrder | null = null;
      try {
        stored = JSON.parse(
          sessionStorage.getItem(`order-${orderNumber}`) || "null",
        ) as StoredOrder | null;
      } catch {
        stored = null;
      }

      const sessionId = new URLSearchParams(window.location.search).get("session_id");
      if (sessionId?.startsWith("cs_")) {
        try {
          const payment = await confirmStripeCheckout({ data: { sessionId } });
          if (payment.accessToken) {
            const nextStored: StoredOrder = {
              number: payment.orderNumber || orderNumber,
              accessToken: payment.accessToken,
              fulfillment: stored?.fulfillment ?? "shipping",
              total: stored?.total ?? 0,
              ...(stored?.subtotal != null ? { subtotal: stored.subtotal } : {}),
              ...(stored?.shipping != null ? { shipping: stored.shipping } : {}),
              ...(stored?.tax != null ? { tax: stored.tax } : {}),
              persisted: "database",
              data: stored?.data ?? {},
            };
            sessionStorage.setItem(`order-${orderNumber}`, JSON.stringify(nextStored));
            stored = nextStored;
          }
          if (payment.paymentStatus !== "paid") {
            if (!cancelled) {
              setConfirmed(null);
              setLoadError(
                payment.paymentStatus === "failed"
                  ? "Payment was not completed."
                  : "Payment is still processing. Refresh in a moment.",
              );
              setLoading(false);
            }
            return;
          }
          window.history.replaceState({}, "", `/confirmation/${encodeURIComponent(orderNumber)}`);
        } catch (err) {
          console.error("[confirmation] Stripe session confirm failed", err);
          // Fall through to receipt lookup — webhook may have already marked paid.
        }
      }

      const accessToken = stored?.accessToken ? String(stored.accessToken).trim() : "";
      const isDevLocal = import.meta.env.DEV && stored?.persisted === "local";
      const isDatabaseOrder =
        stored?.persisted === "database" ||
        (Boolean(accessToken) && stored?.persisted !== "local");

      // Real Supabase orders: receipt fetch is required. Never invent/replace with session totals.
      if (isDatabaseOrder && accessToken) {
        try {
          if (import.meta.env.DEV) {
            console.info("[confirmation] fetching receipt", {
              orderNumber,
              accessTokenLength: accessToken.length,
              storageKey: `order-${orderNumber}`,
            });
          }
          const receipt = await getOrderReceipt({
            data: { orderNumber, accessToken },
          });
          if (!cancelled && receipt) {
            const confirmedTotals: ConfirmedTotals = {
              orderNumber: receipt.orderNumber,
              totalCents: receipt.totalCents,
              fulfillment: receipt.fulfillmentMethod,
              fromDatabase: true,
            };
            const email = receipt.customerEmail ?? stored?.data?.["email"];
            if (email) confirmedTotals.email = email;
            if (receipt.shippingAddress) {
              confirmedTotals.shippingName =
                `${receipt.shippingAddress.firstName} ${receipt.shippingAddress.lastName}`.trim();
              confirmedTotals.shippingLines = [
                [receipt.shippingAddress.addressLine1, receipt.shippingAddress.addressLine2]
                  .filter(Boolean)
                  .join(", "),
                `${receipt.shippingAddress.city}, ${receipt.shippingAddress.state} ${receipt.shippingAddress.postalCode}`,
              ];
            }
            setConfirmed(confirmedTotals);
            setLoadError(null);
            setLoading(false);
            return;
          }
          if (!cancelled) {
            setConfirmed(null);
            setLoadError("Unable to load order details.");
            setLoading(false);
          }
          return;
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error("[confirmation] getOrderReceipt failed", {
              orderNumber,
              accessTokenPresent: Boolean(accessToken),
              error: err,
            });
          }
          if (!cancelled) {
            setConfirmed(null);
            setLoadError("Unable to load order details.");
            setLoading(false);
          }
          return;
        }
      }

      if (import.meta.env.DEV && !accessToken) {
        console.error("[confirmation] missing accessToken in sessionStorage", {
          orderNumber,
          storageKey: `order-${orderNumber}`,
          storedPersisted: stored?.persisted ?? null,
        });
      }

      // Development-only local orders may use session snapshot.
      if (isDevLocal && stored) {
        if (!cancelled) {
          const localConfirmed: ConfirmedTotals = {
            orderNumber: stored.number || orderNumber,
            totalCents: stored.total,
            fulfillment: stored.fulfillment,
            shippingName: `${stored.data?.["firstName"] ?? ""} ${stored.data?.["lastName"] ?? ""}`.trim(),
            shippingLines: [
              [stored.data?.["address"], stored.data?.["apartment"]].filter(Boolean).join(", "),
              `${stored.data?.["city"] ?? ""}, ${stored.data?.["state"] ?? ""} ${stored.data?.["zip"] ?? ""}`.trim(),
            ],
            fromDatabase: false,
          };
          const email = stored.data?.["email"];
          if (email) localConfirmed.email = email;
          setConfirmed(localConfirmed);
          setLoadError(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setConfirmed(null);
        setLoadError("Unable to load order details.");
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  const pickup = confirmed?.fulfillment === "studio_pickup";
  // Always prefer the real URL/order number returned by the server — never fabricate one.
  const displayNumber = confirmed?.orderNumber || orderNumber;

  if (loadError) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <section className="mx-auto max-w-2xl px-5 py-16 text-center md:py-24">
          <p className="label-mono text-primary">Order #{displayNumber}</p>
          <h1 className="mt-4 font-display text-5xl">Unable to load order details</h1>
          <p className="mx-auto mt-5 max-w-lg leading-7 text-muted-foreground">
            Your order number is {displayNumber}. If you just placed this order, it may still be
            processing — please check your email or contact the studio with this order number.
          </p>
          <Link
            to="/print"
            className="mt-8 inline-flex rounded-full bg-foreground px-7 py-4 label-mono text-white"
          >
            Back to prints
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-5 py-16 text-center md:py-24">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-white">
          <Check size={30} />
        </div>
        <p className="label-mono mt-8 text-primary">Order #{displayNumber}</p>
        <h1 className="mt-4 font-display text-6xl">Thank you for your order</h1>
        {loading ? (
          <p className="mx-auto mt-5 max-w-lg leading-7 text-muted-foreground">
            Loading order details…
          </p>
        ) : (
          <>
            <p className="mx-auto mt-5 max-w-lg leading-7 text-muted-foreground">
              A confirmation will be sent to {confirmed?.email || "your email address"}. Your
              photographs are now reserved for production.
            </p>
            <div className="mt-10 rounded-3xl border bg-card p-7 text-left">
              <p className="label-mono">{pickup ? "Studio pickup" : "Shipping"}</p>
              {pickup ? (
                <>
                  <h2 className="mt-4 font-display text-3xl">
                    We’ll email you when your prints are ready.
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {studio.name}
                    <br />
                    {studio.address}
                    <br />
                    {studio.cityLine}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-4 font-display text-3xl">Your order will be shipped to:</h2>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {confirmed?.shippingName}
                    <br />
                    {confirmed?.shippingLines?.[0]}
                    <br />
                    {confirmed?.shippingLines?.[1]}
                  </p>
                </>
              )}
              {confirmed && confirmed.totalCents > 0 && (
                <div className="mt-6 flex justify-between border-t pt-5">
                  <strong>Total</strong>
                  <strong>{formatCents(confirmed.totalCents)}</strong>
                </div>
              )}
            </div>
          </>
        )}
        <Link
          to="/print"
          className="mt-8 inline-flex rounded-full bg-foreground px-7 py-4 label-mono text-white"
        >
          Upload more photos
        </Link>
      </section>
    </main>
  );
}
