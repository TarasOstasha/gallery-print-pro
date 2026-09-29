import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Package, Settings, ShoppingBag, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ordersActive = pathname === "/admin" || pathname.startsWith("/admin/orders");

  return (
    <main className="min-h-screen bg-[#111317] text-white">
      <header className="flex h-20 items-center justify-between border-b border-white/10 px-5 md:px-8">
        <Link
          to="/"
          className="flex items-center gap-3"
          aria-label="Dynasty Pix — A Legacy Worth Remembering"
        >
          <span className="flex flex-col items-start leading-none">
            <img src="/images/dynasty-pix-logo.png" alt="Dynasty Pix" className="h-9 w-auto" />
            <span className="-mt-1.5 font-display text-[11px] italic leading-none tracking-[0.04em] text-white/55">
              A Legacy Worth Remembering
            </span>
          </span>
          <span className="font-sans text-xs text-white/35">/ Admin</span>
        </Link>
        <Link to="/" className="label-mono text-white/60">
          View storefront
        </Link>
      </header>
      <div className="grid md:grid-cols-[220px_1fr]">
        <aside className="hidden min-h-[calc(100vh-5rem)] border-r border-white/10 p-4 md:block">
          <nav className="space-y-1">
            <NavLink to="/admin" icon={<ShoppingBag />} label="Orders" active={ordersActive} />
            <Nav icon={<Upload />} label="Customer uploads" />
            <Nav icon={<Package />} label="Products" />
            <Nav icon={<Settings />} label="Settings" />
          </nav>
        </aside>
        <section className="p-5 md:p-10">
          <Outlet />
        </section>
      </div>
    </main>
  );
}

function NavLink({
  to,
  icon,
  label,
  active = false,
}: {
  to: "/admin";
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm ${active ? "bg-white text-black" : "text-white/55 hover:bg-white/5"}`}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {label}
    </Link>
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
