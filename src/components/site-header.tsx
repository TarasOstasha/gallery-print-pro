import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  const { count } = useCart();
  return (
    <header
      className={`flex h-16 items-center justify-between px-5 md:px-10 ${dark ? "text-white" : "text-foreground"}`}
    >
      <Link
        to="/"
        className="flex flex-col items-start leading-none"
        aria-label="Dynasty Pix — A Legacy Worth Remembering"
      >
        <img
          src="/images/dynasty-pix-logo.png"
          alt="Dynasty Pix"
          className="h-8 w-auto md:h-9"
        />
        <span className="-mt-1.5 font-display text-[10px] italic leading-none tracking-[0.04em] opacity-75 md:-mt-2 md:text-[11px]">
          A Legacy Worth Remembering
        </span>
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
