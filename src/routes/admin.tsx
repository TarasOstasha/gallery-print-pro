import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Image, Package, Settings, ShoppingBag } from "lucide-react";
import { photos, product } from "@/lib/catalog";
export const Route = createFileRoute("/admin")({ component: Admin });
const orders = [
  {
    number: "10252",
    customer: "Elena Rossi",
    date: "Today, 10:42",
    total: "$74.47",
    fulfillment: "STUDIO PICKUP",
    status: "New",
  },
  {
    number: "10251",
    customer: "Marcus Lee",
    date: "Yesterday",
    total: "$118.75",
    fulfillment: "SHIPPING",
    status: "Processing",
  },
  {
    number: "10250",
    customer: "Ava Williams",
    date: "Sep 18",
    total: "$42.08",
    fulfillment: "STUDIO PICKUP",
    status: "Ready for pickup",
  },
];
function Admin() {
  return (
    <main className="min-h-screen bg-[#111317] text-white">
      <header className="flex h-20 items-center justify-between border-b border-white/10 px-5 md:px-8">
        <Link to="/" className="font-display text-2xl">
          Atelier Nord <span className="font-sans text-xs text-white/35">/ Admin</span>
        </Link>
        <Link to="/" className="label-mono text-white/60">
          View gallery
        </Link>
      </header>
      <div className="grid md:grid-cols-[220px_1fr]">
        <aside className="hidden min-h-[calc(100vh-5rem)] border-r border-white/10 p-4 md:block">
          <nav className="space-y-1">
            <Nav icon={<ShoppingBag />} label="Orders" active />
            <Nav icon={<CalendarDays />} label="Galleries" />
            <Nav icon={<Package />} label="Products" />
            <Nav icon={<Settings />} label="Settings" />
          </nav>
        </aside>
        <section className="p-5 md:p-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="label-mono text-primary">Dashboard</p>
              <h1 className="mt-3 font-display text-5xl">Good afternoon.</h1>
            </div>
            <button className="rounded-full bg-white px-5 py-3 label-mono text-black">
              Create gallery
            </button>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <Stat label="Open orders" value="12" />
            <Stat label="Published gallery" value="1" />
            <Stat label="Print products" value={String(product.variants.length)} />
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <p className="label-mono text-white/45">Recent orders</p>
                <h2 className="mt-2 font-display text-3xl">Production queue</h2>
              </div>
            </div>
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
                  {orders.map((o) => (
                    <tr key={o.number} className="border-t border-white/10">
                      <td className="p-5">
                        <strong>#{o.number}</strong>
                        <small className="mt-1 block text-white/40">{o.date}</small>
                      </td>
                      <td>{o.customer}</td>
                      <td>
                        <span
                          className={`rounded-full px-3 py-1 font-mono text-[10px] ${o.fulfillment === "SHIPPING" ? "bg-blue-400/15 text-blue-300" : "bg-amber-400/15 text-amber-300"}`}
                        >
                          {o.fulfillment}
                        </span>
                      </td>
                      <td>{o.status}</td>
                      <td>{o.total}</td>
                      <td>
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-mono text-white/45">Gallery</p>
                  <h3 className="mt-2 font-display text-3xl">Runway 7, 2026</h3>
                </div>
                <Image className="text-primary" />
              </div>
              <p className="mt-6 text-sm text-white/50">Published · {photos.length} photographs</p>
            </div>
            <div className="rounded-2xl border border-white/10 p-5">
              <p className="label-mono text-white/45">Quick action</p>
              <h3 className="mt-2 font-display text-3xl">Pickup orders</h3>
              <button className="mt-6 rounded-full border border-white/20 px-5 py-3 label-mono">
                Mark ready for pickup
              </button>
            </div>
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
