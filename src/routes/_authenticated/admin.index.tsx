import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatCents } from "@/lib/money";
import { getAdminDashboard, updateOrderStatus } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOrdersIndex,
});

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

function AdminOrdersIndex() {
  const nav = useNavigate();
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

  function openOrder(orderNumber: string) {
    void nav({ to: "/admin/orders/$orderNumber", params: { orderNumber } });
  }

  const orders = data?.orders ?? [];
  const openCount = orders.filter((o) => o.order_status === "new" || o.order_status === "processing")
    .length;
  const variantCount =
    data?.products?.reduce((n, p) => n + (p.product_variants?.length ?? 0), 0) ?? 0;

  return (
    <>
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
                  <th>Photos</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const customer = Array.isArray(o.customers) ? o.customers[0] : o.customers;
                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer border-t border-white/10 hover:bg-white/[.04]"
                      onClick={() => openOrder(o.order_number)}
                    >
                      <td className="p-5">
                        <Link
                          to="/admin/orders/$orderNumber"
                          params={{ orderNumber: o.order_number }}
                          className="font-semibold hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          #{o.order_number}
                        </Link>
                        <small className="mt-1 block text-white/40">
                          {new Date(o.created_at).toLocaleString()}
                        </small>
                      </td>
                      <td>
                        {customer ? `${customer.first_name} ${customer.last_name}` : ""}
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
                      <td>
                        {o.photosStatus === "stored" ? (
                          <span className="text-[10px] uppercase tracking-wider text-emerald-300/80">
                            Photos stored
                          </span>
                        ) : o.photosStatus === "removed" ? (
                          <span className="text-[10px] uppercase tracking-wider text-white/35">
                            Photos removed
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider text-white/25">
                            —
                          </span>
                        )}
                      </td>
                      <td>{formatCents(o.total_cents)}</td>
                      <td className="pr-5 text-right">
                        {o.fulfillment_method === "studio_pickup" && o.order_status === "new" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void markReady(o.id);
                            }}
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
    </>
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
