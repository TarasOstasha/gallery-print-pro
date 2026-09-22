import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Package, Settings, ShoppingBag, Upload } from "lucide-react";
import { product } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { listLocalOrders, updateLocalOrderStatus, type LocalOrderRecord } from "@/lib/local-orders";

export const Route = createFileRoute("/admin")({ component: Admin });

function Admin() {
  const [orders, setOrders] = useState<LocalOrderRecord[]>([]);

  useEffect(() => {
    setOrders(listLocalOrders());
  }, []);

  function markReady(orderNumber: string) {
    updateLocalOrderStatus(orderNumber, "ready_for_pickup");
    setOrders(listLocalOrders());
  }

  return (
    <main className="min-h-screen bg-[#111317] text-white">
      <header className="flex h-20 items-center justify-between border-b border-white/10 px-5 md:px-8">
        <Link to="/" className="font-display text-2xl">
          Atelier Nord <span className="font-sans text-xs text-white/35">/ Admin</span>
        </Link>
        <Link to="/" className="label-mono text-white/60">
          View storefront
        </Link>
      </header>
      <div className="grid md:grid-cols-[220px_1fr]">
        <aside className="hidden min-h-[calc(100vh-5rem)] border-r border-white/10 p-4 md:block">
          <nav className="space-y-1">
            <Nav icon={<ShoppingBag />} label="Orders" active />
            <Nav icon={<Upload />} label="Customer uploads" />
            <Nav icon={<Package />} label="Products" />
            <Nav icon={<Settings />} label="Settings" />
          </nav>
        </aside>
        <section className="p-5 md:p-10">
          <div>
            <p className="label-mono text-primary">Dashboard</p>
            <h1 className="mt-3 font-display text-5xl">Print orders</h1>
            <p className="mt-3 max-w-xl text-sm text-white/50">
              Orders from customer uploads. When Supabase service role and storage are connected,
              orders persist to the database automatically.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <Stat label="Open orders" value={String(orders.filter((o) => o.orderStatus === "new").length)} />
            <Stat label="Total orders" value={String(orders.length)} />
            <Stat label="Print sizes" value={String(product.variants.length)} />
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
            <div className="border-b border-white/10 p-5">
              <p className="label-mono text-white/45">Recent orders</p>
              <h2 className="mt-2 font-display text-3xl">Production queue</h2>
            </div>
            {orders.length === 0 ? (
              <p className="p-8 text-sm text-white/45">No orders yet. Place a test order from checkout.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-white/35">
                    <tr>
                      <th className="p-5">Order</th>
                      <th>Customer</th>
                      <th>Prints</th>
                      <th>Fulfillment</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.orderNumber} className="border-t border-white/10">
                        <td className="p-5">
                          <strong>#{o.orderNumber}</strong>
                          <small className="mt-1 block text-white/40">
                            {new Date(o.createdAt).toLocaleString()}
                          </small>
                        </td>
                        <td>
                          {o.customer.firstName} {o.customer.lastName}
                          <small className="block text-white/40">{o.customer.email}</small>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            {o.items.slice(0, 3).map((item) => (
                              <img
                                key={item.key}
                                src={item.photoUrl}
                                alt=""
                                className="h-10 w-10 rounded object-cover"
                              />
                            ))}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`rounded-full px-3 py-1 font-mono text-[10px] ${o.fulfillment === "shipping" ? "bg-blue-400/15 text-blue-300" : "bg-amber-400/15 text-amber-300"}`}
                          >
                            {o.fulfillment === "shipping" ? "SHIPPING" : "STUDIO PICKUP"}
                          </span>
                        </td>
                        <td>{o.orderStatus.replaceAll("_", " ")}</td>
                        <td>{formatCents(o.totalCents)}</td>
                        <td>
                          {o.fulfillment === "studio_pickup" && o.orderStatus === "new" && (
                            <button
                              type="button"
                              onClick={() => markReady(o.orderNumber)}
                              className="rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-wider"
                            >
                              Ready
                            </button>
                          )}
                          <ChevronRight size={16} className="ml-2 inline opacity-40" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Nav({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm ${active ? "bg-white text-black" : "text-white/55 hover:bg-white/5"}`}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
      <p className="label-mono text-white/40">{label}</p>
      <strong className="mt-3 block font-display text-5xl font-medium">{value}</strong>
    </div>
  );
}
