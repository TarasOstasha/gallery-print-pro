import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, Check, Truck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getGalleryData } from "@/lib/catalog.functions";
import {
  shippingMethods as fallbackShippingMethods,
  studio as fallbackStudio,
} from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { formatCents } from "@/lib/money";
import { getCustomerPhotoOriginalBase64 } from "@/lib/customer-photos";
import { saveLocalOrder } from "@/lib/local-orders";
import {
  PRINT_CANCELLATION_POLICY_SECTIONS,
  PRINT_CANCELLATION_POLICY_TITLE,
} from "@/lib/print-cancellation-policy";
import { placeOrder } from "@/orders.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({ component: Checkout });

const MIN_ORDER_CENTS = 2000;

type CheckoutShippingMethod = {
  code: string;
  name: string;
  detail: string;
  priceCents: number;
};

const input =
  "mt-2 w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#039333]";

function Checkout() {
  const { items, subtotalCents, clear } = useCart();
  const nav = useNavigate();
  const [fulfillment, setFulfillment] = useState<"shipping" | "studio_pickup">("shipping");
  const [shippingMethods, setShippingMethods] = useState<CheckoutShippingMethod[]>(
    fallbackShippingMethods.map((m) => ({
      code: m.code,
      name: m.name,
      detail: m.detail,
      priceCents: m.priceCents,
    })),
  );
  const [taxRate, setTaxRate] = useState(fallbackStudio.taxRate);
  const [shipping, setShipping] = useState(fallbackShippingMethods[0]?.code ?? "standard");
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("canceled") === "1") {
      toast.message("Payment canceled. Start a new order when you’re ready.");
      window.history.replaceState({}, "", "/checkout");
    }
  }, []);

  useEffect(() => {
    void getGalleryData()
      .then((data) => {
        if (data.shippingMethods.length > 0) {
          const methods = data.shippingMethods.map((m) => ({
            code: m.code,
            name: m.name,
            detail: m.estimatedDays || m.description || "",
            priceCents: m.priceCents,
          }));
          setShippingMethods(methods);
          setShipping((current) =>
            methods.some((m) => m.code === current) ? current : methods[0]!.code,
          );
        }
        if (data.studio && Number.isFinite(data.studio.taxRate)) {
          setTaxRate(data.studio.taxRate);
        }
      })
      .catch(() => {
        /* keep hard-coded catalog fallbacks for display only */
      });
  }, []);

  const selectedShip = shippingMethods.find((m) => m.code === shipping);
  const ship = fulfillment === "shipping" ? (selectedShip?.priceCents ?? 0) : 0;
  const tax = Math.round((subtotalCents + ship) * taxRate);
  const total = subtotalCents + ship + tax;
  const meetsMinimum = subtotalCents >= MIN_ORDER_CENTS;
  const canPlaceOrder = meetsMinimum && termsAccepted && !submitting;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!meetsMinimum) {
      toast.error("Minimum order is $20.00.");
      return;
    }
    if (!termsAccepted) {
      toast.error("Please agree to the Print Cancellation Policy & Terms.");
      return;
    }
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
        termsAccepted,
        checkoutOrigin: window.location.origin,
        customer: {
          firstName: data["firstName"]!,
          lastName: data["lastName"]!,
          email: data["email"]!,
          phone: data["phone"] ?? "",
        },
        shippingAddress:
          fulfillment === "shipping"
            ? {
                address: data["address"]!,
                ...(data["apartment"] ? { apartment: data["apartment"] } : {}),
                city: data["city"]!,
                state: data["state"]!,
                zip: data["zip"]!,
                country: data["country"] ?? "United States",
              }
            : null,
        items: items.map((i) => ({
          photoId: i.photoId,
          photoNumber: i.photoNumber,
          productVariantId: i.productVariantId,
          sizeLabel: i.sizeLabel,
          quantity: i.quantity,
          border: Boolean(i.border),
          mountingId: i.mountingId || "print-only",
          ...(typeof i.cropX === "number" ? { cropX: i.cropX } : {}),
          ...(typeof i.cropY === "number" ? { cropY: i.cropY } : {}),
        })),
        photoFiles,
        totals: { subtotalCents, shippingCents: ship, taxCents: tax, totalCents: total },
      } as const;

      const result = await placeOrder({ data: payload });

      // Clear cart only after a successful placeOrder response.
      // Production never returns a local/fake order on DB failure.
      if (result.persisted === "local") {
        if (!import.meta.env.DEV) {
          toast.error("Could not place order. Try again.");
          return;
        }
        saveLocalOrder({
          orderNumber: result.orderNumber,
          accessToken: result.accessToken,
          fulfillment,
          shippingMethodCode: fulfillment === "shipping" ? shipping : null,
          subtotalCents: result.subtotalCents,
          shippingCents: result.shippingCents,
          taxCents: result.taxCents,
          totalCents: result.totalCents,
          paymentStatus: "paid",
          orderStatus: "new",
          createdAt: new Date().toISOString(),
          customer: payload.customer,
          shippingAddress: fulfillment === "shipping" ? data : null,
          items,
        });
        clear();
        void nav({ to: "/confirmation/$orderNumber", params: { orderNumber: String(result.orderNumber) } });
        return;
      }

      // Preserve secure receipt credentials before Stripe redirect.
      const orderNumber = String(result.orderNumber);
      const accessToken = String(result.accessToken);
      sessionStorage.setItem(
        `order-${orderNumber}`,
        JSON.stringify({
          number: orderNumber,
          accessToken,
          fulfillment,
          total: result.totalCents,
          subtotal: result.subtotalCents,
          shipping: result.shippingCents,
          tax: result.taxCents,
          persisted: "database",
          data,
          items,
        }),
      );

      if (result.checkoutUrl) {
        clear();
        window.location.assign(result.checkoutUrl);
        return;
      }

      toast.error("Payment could not be started. Try again.");
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error && err.message
          ? err.message.replace(/^VALIDATION:\s*/i, "")
          : "Could not place order. Try again.";
      const known =
        message.includes("Minimum order") ||
        message.includes("Print Cancellation") ||
        message.includes("crop") ||
        message.includes("cart is empty") ||
        message.includes("Unavailable") ||
        message.includes("shipping method") ||
        message.includes("delivery method") ||
        message.includes("Stripe") ||
        message.includes("checkout origin");
      toast.error(known ? message : "Could not place order. Try again.");
      // Do not clear cart on failure.
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
          <Link to="/print" className="mt-6 inline-block underline">
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
          <p className="label-mono text-[#039333]">Secure checkout</p>
          <h1 className="mt-3 font-display text-6xl">How should we deliver?</h1>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setFulfillment("shipping")}
              className={`rounded-2xl border p-5 text-left ${fulfillment === "shipping" ? "border-[#039333] bg-accent ring-1 ring-[#039333]" : "bg-card"}`}
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
              className={`rounded-2xl border p-5 text-left ${fulfillment === "studio_pickup" ? "border-[#039333] bg-accent ring-1 ring-[#039333]" : "bg-card"}`}
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
                          className="mr-3 accent-[#039333]"
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
                <div className="flex items-center gap-2 text-[#039333]">
                  <Check size={18} />
                  <span className="label-mono">Studio pickup · $0.00 shipping</span>
                </div>
                <strong className="mt-4 block">{fallbackStudio.name}</strong>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {fallbackStudio.address}
                  <br />
                  {fallbackStudio.cityLine}
                  <br />
                  {fallbackStudio.country}
                </p>
                <p className="mt-4 text-sm">We’ll email you when your prints are ready.</p>
              </div>
            )}
          </div>
        </section>
        <aside className="h-fit rounded-3xl bg-[#3C3933] p-6 text-white lg:sticky lg:top-6">
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
              value={formatCents(ship)}
            />
            <Row label="Tax" value={formatCents(tax)} />
            <div className="flex justify-between border-t border-white/15 pt-4 text-lg">
              <strong>Total</strong>
              <strong>{formatCents(total)}</strong>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-white/15 p-4 text-xs leading-5 text-white/60">
            You’ll complete payment securely on Stripe. We never store card numbers.
          </div>
          {!meetsMinimum && (
            <p className="mt-4 text-xs leading-5 text-amber-200">Minimum order is $20.00.</p>
          )}
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-5 text-white/80">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#039333]"
            />
            <span>
              I agree to the{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPolicyOpen(true);
                }}
                className="underline underline-offset-2 hover:text-white"
              >
                Print Cancellation Policy &amp; Terms
              </button>
              .
            </span>
          </label>
          <button
            type="submit"
            disabled={!canPlaceOrder}
            className="mt-5 w-full rounded-full bg-white px-5 py-4 font-sans text-xs uppercase tracking-[.2em] text-black disabled:opacity-60"
          >
            {submitting ? "Redirecting to Stripe…" : "Pay with Stripe"}
          </button>
        </aside>
      </form>

      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto bg-background text-foreground sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-normal tracking-tight">
              {PRINT_CANCELLATION_POLICY_TITLE}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Please review these terms before placing your order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 text-sm leading-6 text-foreground">
            {PRINT_CANCELLATION_POLICY_SECTIONS.map((section) => (
              <div key={section.heading}>
                <p className="label-mono text-[#039333]">{section.heading}</p>
                <p className="mt-2 text-muted-foreground">{section.body}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
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
