import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
export function SiteHeader({ dark = false }: { dark?: boolean }) {
  const { count } = useCart();
  return (
    <header
      className={`flex h-20 items-center justify-between px-5 md:px-10 ${dark ? "text-white" : "text-foreground"}`}
    >
      <Link to="/" className="font-display text-2xl tracking-tight">
        Atelier Nord
      </Link>
      <nav className="flex items-center gap-5">
        <Link to="/print" className="label-mono hidden sm:block">
          Order prints
        </Link>
        <Link to="/admin" className="label-mono hidden sm:block">
          Admin
        </Link>
        <Link
          to="/cart"
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-current/20"
          aria-label={`Cart with ${count} items`}
        >
          <ShoppingBag size={18} />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 font-mono text-[10px] text-white">
              {count}
            </span>
          )}
        </Link>
      </nav>
    </header>
  );
}
