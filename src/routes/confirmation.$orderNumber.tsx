import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { studio } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
export const Route = createFileRoute("/confirmation/$orderNumber")({ component: Confirmation });
type StoredOrder = {
  fulfillment: "shipping" | "studio_pickup";
  total: number;
  data: Record<string, string>;
};
function Confirmation() {
  const { orderNumber } = Route.useParams();
  let order: StoredOrder | null = null;
  if (typeof window !== "undefined") {
    try {
      order = JSON.parse(sessionStorage.getItem(`order-${orderNumber}`) || "null");
    } catch {
      order = null;
    }
  }
  const pickup = order?.fulfillment === "studio_pickup";
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-5 py-16 text-center md:py-24">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-white">
          <Check size={30} />
        </div>
        <p className="label-mono mt-8 text-primary">Order #{orderNumber}</p>
        <h1 className="mt-4 font-display text-6xl">Thank you for your order</h1>
        <p className="mx-auto mt-5 max-w-lg leading-7 text-muted-foreground">
          A confirmation will be sent to {order?.data?.email || "your email address"}. Your
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
                {order?.data?.firstName} {order?.data?.lastName}
                <br />
                {order?.data?.address}
                {order?.data?.apartment ? `, ${order.data.apartment}` : ""}
                <br />
                {order?.data?.city}, {order?.data?.state} {order?.data?.zip}
              </p>
            </>
          )}{" "}
          {order?.total && (
            <div className="mt-6 flex justify-between border-t pt-5">
              <strong>Total</strong>
              <strong>{formatCents(order.total)}</strong>
            </div>
          )}
        </div>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-full bg-foreground px-7 py-4 label-mono text-white"
        >
          Upload more photos
        </Link>
      </section>
    </main>
  );
}
