import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Package, Settings, ShoppingBag, Upload } from "lucide-react";
import { formatCents } from "@/lib/money";
import { getAdminDashboard, updateOrderStatus } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({ component: Admin });

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

function Admin() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const next = await getAdminDashboard();
      setData(next);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function markReady(orderId: string) {
    try {
      await updateOrderStatus({ data: { orderId, status: "ready_for_pickup" } });
      toast.success("Marked ready for pickup");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  const orders = data?.orders ?? [];
  const openCount = orders.filter((o) => o.order_status === "new" || o.order_status === "processing")
    .length;
  const variantCount =
    data?.products?.reduce((n, p) => n + (p.product_variants?.length ?? 0), 0) ?? 0;

  return (
    <main className="min-h-screen bg-[#111317] text-white">
      <header className="flex h-20 items-center justify-between border-b border-white/10 px-5 md:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Dynasty Pix home">
          <img src="/images/dynasty-pix-logo.png" alt="Dynasty Pix" className="h-9 w-auto" />
          <span className="font-sans text-xs text-white/35">/ Admin</span>
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
              Live orders from your Supabase database.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <Stat label="Open orders" value={String(openCount)} />
            <Stat label="Total orders" value={String(orders.length)} />
            <Stat label="Print sizes" value={String(variantCount)} />
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <p className="label-mono text-white/45">Recent orders</p>
                <h2 className="mt-2 font-display text-3xl">Production queue</h2>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-full border border-white/20 px-4 py-2 text-[10px] uppercase tracking-wider"
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <p className="p-8 text-sm text-white/45">Loading orders…</p>
            ) : error ? (
              <p className="p-8 text-sm text-red-300">
                {error}
                <span className="mt-2 block text-white/45">
                  Sign in at /auth with an account that has the admin role.
                </span>
              </p>
            ) : orders.length === 0 ? (
              <p className="p-8 text-sm text-white/45">
                No orders yet. Place a test order from /print → checkout.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-white/35">
                    <tr>
                      <th className="p-5">Order</th>
                      <th>Customer</th>
                      <th>Fulfillment</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const customer = Array.isArray(o.customers) ? o.customers[0] : o.customers;
                      return (
                        <tr key={o.id} className="border-t border-white/10">
                          <td className="p-5">
                            <strong>#{o.order_number}</strong>
                            <small className="mt-1 block text-white/40">
                              {new Date(o.created_at).toLocaleString()}
                            </small>
                          </td>
                          <td>
                            {customer
                              ? `${customer.first_name} ${customer.last_name}`
                              : "—"}
                            <small className="block text-white/40">{customer?.email}</small>
                          </td>
                          <td>
                            <span
                              className={`rounded-full px-3 py-1 font-mono text-[10px] ${o.fulfillment_method === "shipping" ? "bg-blue-400/15 text-blue-300" : "bg-amber-400/15 text-amber-300"}`}
                            >
                              {o.fulfillment_method === "shipping" ? "SHIPPING" : "STUDIO PICKUP"}
                            </span>
                          </td>
                          <td>{o.order_status.replaceAll("_", " ")}</td>
                          <td>{formatCents(o.total_cents)}</td>
                          <td>
                            {o.fulfillment_method === "studio_pickup" &&
                              o.order_status === "new" && (
                                <button
                                  type="button"
                                  onClick={() => void markReady(o.id)}
                                  className="rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-wider"
                                >
                                  Ready
                                </button>
                              )}
                            <ChevronRight size={16} className="ml-2 inline opacity-40" />
                          </td>
                        </tr>
                      );
                    })}
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
