import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Building2, Check, Truck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { shippingMethods, studio } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { formatCents } from "@/lib/money";
import { getCustomerPhotoOriginalBase64 } from "@/lib/customer-photos";
import { saveLocalOrder } from "@/lib/local-orders";
import { placeOrder } from "@/orders.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({ component: Checkout });

const input =
  "mt-2 w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary";

function Checkout() {
  const { items, subtotalCents, clear } = useCart();
  const nav = useNavigate();
  const [fulfillment, setFulfillment] = useState<"shipping" | "studio_pickup">("shipping");
  const [shipping, setShipping] = useState("standard");
  const [submitting, setSubmitting] = useState(false);
  const ship =
    fulfillment === "shipping" ? shippingMethods.find((m) => m.code === shipping)!.priceCents : 0;
  const tax = Math.round((subtotalCents + ship) * studio.taxRate);
  const total = subtotalCents + ship + tax;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const photoIds = [...new Set(items.map((i) => i.photoId))];
      const photoFiles = [];
      for (const id of photoIds) {
        const file = await getCustomerPhotoOriginalBase64(id);
        const item = items.find((i) => i.photoId === id)!;
        if (!file) {
          toast.error(`Missing original file for ${item.photoNumber}`);
          setSubmitting(false);
          return;
        }
        photoFiles.push({
          photoId: id,
          photoNumber: item.photoNumber,
          base64: file.base64,
          mimeType: file.mimeType,
          fileName: file.fileName,
          width: item.photoWidth ?? 0,
          height: item.photoHeight ?? 0,
        });
      }

      const payload = {
        fulfillment,
        shippingMethodCode: fulfillment === "shipping" ? shipping : null,
        customer: {
          firstName: data.firstName!,
          lastName: data.lastName!,
          email: data.email!,
          phone: data.phone ?? "",
        },
        shippingAddress:
          fulfillment === "shipping"
            ? {
                address: data.address!,
                apartment: data.apartment,
                city: data.city!,
                state: data.state!,
                zip: data.zip!,
                country: data.country ?? "United States",
              }
            : null,
        items: items.map((i) => ({
          photoId: i.photoId,
          photoNumber: i.photoNumber,
          productVariantId: i.productVariantId,
          sizeLabel: i.sizeLabel,
          quantity: i.quantity,
        })),
        photoFiles,
        totals: { subtotalCents, shippingCents: ship, taxCents: tax, totalCents: total },
      };

      const result = await placeOrder({ data: payload });

      if (result.persisted === "local") {
        saveLocalOrder({
          orderNumber: result.orderNumber,
          accessToken: result.accessToken,
          fulfillment,
          shippingMethodCode: fulfillment === "shipping" ? shipping : null,
          subtotalCents,
          shippingCents: ship,
          taxCents: tax,
          totalCents: total,
          paymentStatus: "paid",
          orderStatus: "new",
          createdAt: new Date().toISOString(),
          customer: payload.customer,
          shippingAddress: fulfillment === "shipping" ? data : null,
          items,
        });
      } else {
        sessionStorage.setItem(
          `order-${result.orderNumber}`,
          JSON.stringify({
            number: result.orderNumber,
            accessToken: result.accessToken,
            fulfillment,
            total: result.totalCents,
            data,
            items,
          }),
        );
      }

      clear();
      void nav({ to: "/confirmation/$orderNumber", params: { orderNumber: result.orderNumber } });
    } catch (err) {
      console.error(err);
      toast.error("Could not place order. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!items.length)
    return (
      <main>
        <SiteHeader />
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="font-display text-5xl">Your cart is empty</h1>
          <Link to="/" className="mt-6 inline-block underline">
            Upload photos
          </Link>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <form
        onSubmit={(e) => void submit(e)}
        className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:px-10 lg:grid-cols-[1fr_360px]"
      >
        <section>
          <p className="label-mono text-primary">Secure checkout</p>
          <h1 className="mt-3 font-display text-6xl">How should we deliver?</h1>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setFulfillment("shipping")}
              className={`rounded-2xl border p-5 text-left ${fulfillment === "shipping" ? "border-primary bg-accent ring-1 ring-primary" : "bg-card"}`}
            >
              <Truck />
              <strong className="mt-5 block">Ship my order</strong>
              <span className="mt-1 block text-sm text-muted-foreground">
                Have my prints shipped to my address.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFulfillment("studio_pickup")}
              className={`rounded-2xl border p-5 text-left ${fulfillment === "studio_pickup" ? "border-primary bg-accent ring-1 ring-primary" : "bg-card"}`}
            >
              <Building2 />
              <strong className="mt-5 block">Studio pickup</strong>
              <span className="mt-1 block text-sm text-muted-foreground">
                Collect your prints directly from our studio.
              </span>
            </button>
          </div>
          <div className="mt-10 rounded-3xl border bg-card p-5 md:p-8">
            <h2 className="font-display text-3xl">Contact information</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field name="firstName" label="First name" />
              <Field name="lastName" label="Last name" />
              <Field name="email" type="email" label="Email" />
              <Field name="phone" type="tel" label="Phone" />
            </div>
            {fulfillment === "shipping" ? (
              <>
                <h2 className="mt-10 font-display text-3xl">Shipping address</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field name="address" label="Address" wide />
                  <Field name="apartment" label="Apartment / suite" wide required={false} />
                  <Field name="city" label="City" />
                  <Field name="state" label="State" />
                  <Field name="zip" label="ZIP code" />
                  <Field name="country" label="Country" value="United States" />
                </div>
                <h2 className="mt-10 font-display text-3xl">Shipping method</h2>
                <div className="mt-4 space-y-2">
                  {shippingMethods.map((m) => (
                    <label
                      key={m.code}
                      className="flex cursor-pointer items-center justify-between rounded-xl border p-4"
                    >
                      <span>
                        <input
                          type="radio"
                          name="shippingMethod"
                          value={m.code}
                          checked={shipping === m.code}
                          onChange={() => setShipping(m.code)}
                          className="mr-3"
                        />
                        <strong>{m.name}</strong>
                        <small className="ml-2 text-muted-foreground">{m.detail}</small>
                      </span>
                      <span>{formatCents(m.priceCents)}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-10 rounded-2xl bg-accent p-6">
                <div className="flex items-center gap-2 text-primary">
                  <Check size={18} />
                  <span className="label-mono">Studio pickup · Free</span>
                </div>
                <strong className="mt-4 block">{studio.name}</strong>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {studio.address}
                  <br />
                  {studio.cityLine}
                  <br />
                  {studio.country}
                </p>
                <p className="mt-4 text-sm">We’ll email you when your prints are ready.</p>
              </div>
            )}
          </div>
        </section>
        <aside className="h-fit rounded-3xl bg-foreground p-6 text-white lg:sticky lg:top-6">
          <p className="label-mono text-white/55">Order summary</p>
          <div className="mt-5 max-h-56 space-y-3 overflow-auto">
            {items.map((i) => (
              <div key={i.key} className="flex gap-3">
                <img src={i.photoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm">{i.photoNumber}</strong>
                  <span className="text-xs text-white/55">
                    {i.sizeLabel} · Qty {i.quantity}
                  </span>
                </div>
                <span className="text-sm">{formatCents(i.unitPriceCents * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3 border-t border-white/15 pt-5 text-sm">
            <Row label="Subtotal" value={formatCents(subtotalCents)} />
            <Row
              label={fulfillment === "shipping" ? "Shipping" : "Studio pickup"}
              value={ship ? formatCents(ship) : "FREE"}
            />
            <Row label="Tax" value={formatCents(tax)} />
            <div className="flex justify-between border-t border-white/15 pt-4 text-lg">
              <strong>Total</strong>
              <strong>{formatCents(total)}</strong>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-white/15 p-4 text-xs leading-5 text-white/60">
            Payment is Stripe-ready. This preview safely creates a test order without collecting
            card details.
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-full bg-white px-5 py-4 label-mono text-black disabled:opacity-60"
          >
            {submitting ? "Placing order…" : "Place test order"}
          </button>
        </aside>
      </form>
    </main>
  );
}

function Field({
  name,
  label,
  type = "text",
  wide = false,
  required = true,
  value,
}: {
  name: string;
  label: string;
  type?: string;
  wide?: boolean;
  required?: boolean;
  value?: string;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="label-mono">{label}</span>
      <input className={input} name={name} type={type} required={required} defaultValue={value} />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/60">{label}</span>
      <span>{value}</span>
    </div>
  );
}
