import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useCart } from "@/lib/cart";
import { formatCents } from "@/lib/money";
export const Route = createFileRoute("/cart")({ component: CartPage });
function CartPage() {
  const { items, subtotalCents, setQuantity, removeItem } = useCart();
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-5 py-12 md:px-10 md:py-20">
        <p className="label-mono text-primary">Your selection</p>
        <h1 className="mt-3 font-display text-6xl">Shopping cart</h1>
        {items.length === 0 ? (
          <div className="mt-16 rounded-3xl border bg-card p-12 text-center">
            <p className="font-display text-3xl italic">Your cart is waiting for a photograph.</p>
            <Link
              to="/"
              className="mt-6 inline-flex rounded-full bg-foreground px-6 py-4 label-mono text-white"
            >
              Upload photos
            </Link>
          </div>
        ) : (
          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_340px]">
            <div className="space-y-3">
              {items.map((item) => (
                <article
                  key={item.key}
                  className="grid grid-cols-[100px_1fr] gap-4 rounded-2xl border bg-card p-3 sm:grid-cols-[120px_1fr_auto]"
                >
                  <img
                    src={item.photoUrl}
                    alt={item.photoNumber}
                    className="aspect-square h-full w-full rounded-xl object-cover"
                  />
                  <div className="py-2">
                    <p className="label-mono text-primary">{item.photoNumber}</p>
                    <h2 className="mt-2 font-display text-2xl">{item.productName}</h2>
                    <p className="text-sm text-muted-foreground">
                      {item.sizeLabel} · {formatCents(item.unitPriceCents)} each
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        className="icon-button !h-8 !w-8"
                        onClick={() => setQuantity(item.key, item.quantity - 1)}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-5 text-center text-sm">{item.quantity}</span>
                      <button
                        className="icon-button !h-8 !w-8"
                        onClick={() => setQuantity(item.key, item.quantity + 1)}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => removeItem(item.key)}
                        className="ml-2 text-muted-foreground hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <strong className="col-start-2 self-center text-right sm:col-start-auto">
                    {formatCents(item.unitPriceCents * item.quantity)}
                  </strong>
                </article>
              ))}
            </div>
            <aside className="h-fit rounded-3xl bg-foreground p-6 text-white lg:sticky lg:top-6">
              <p className="label-mono text-white/55">Order summary</p>
              <div className="mt-6 flex justify-between border-b border-white/15 pb-5">
                <span>Subtotal</span>
                <strong>{formatCents(subtotalCents)}</strong>
              </div>
              <p className="mt-4 text-xs leading-5 text-white/55">
                Shipping and tax are calculated at checkout.
              </p>
              <Link
                to="/checkout"
                className="mt-6 flex w-full items-center justify-center rounded-full bg-white px-5 py-4 label-mono text-black"
              >
                Proceed to checkout
              </Link>
              <Link to="/" className="mt-4 block text-center text-xs text-white/60 underline">
                Continue shopping
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
