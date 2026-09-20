import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Heart, ShoppingBag, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { event, photos, product } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
export const Route = createFileRoute("/")({ component: Gallery });

function Gallery() {
  const [selected, setSelected] = useState<number | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [variantId, setVariantId] = useState(product.variants[2].id);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();
  const photo = selected === null ? null : photos[selected];
  const variant = product.variants.find((v) => v.id === variantId)!;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (selected === null) return;
      if (e.key === "Escape") {
        setSelected(null);
        setOrdering(false);
      }
      if (e.key === "ArrowRight") setSelected((selected + 1) % photos.length);
      if (e.key === "ArrowLeft") setSelected((selected - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected]);
  function add() {
    if (!photo) return;
    addItem({
      photoId: photo.id,
      photoNumber: photo.number,
      photoUrl: photo.url,
      eventSlug: event.slug,
      productId: product.id,
      productName: product.name,
      productVariantId: variant.id,
      sizeLabel: variant.label,
      unitPriceCents: variant.priceCents,
      quantity,
    });
    toast.success(`${photo.number} · ${variant.label} added to cart`);
    setOrdering(false);
  }
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <section className="px-5 pb-10 pt-10 md:px-10 md:pb-16 md:pt-20">
        <p className="label-mono text-primary">Event archive · {event.date}</p>
        <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <h1 className="max-w-4xl font-display text-6xl leading-[.88] tracking-[-.045em] md:text-[clamp(5rem,11vw,10rem)]">
            Runway <span className="italic text-primary">7</span>
          </h1>
          <div className="max-w-xs pb-2 text-sm leading-6 text-muted-foreground">
            <p>{event.description}</p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-widest">
              {event.location} · {photos.length} photographs
            </p>
          </div>
        </div>
      </section>
      <section className="columns-1 gap-3 px-3 pb-16 sm:columns-2 lg:columns-3 xl:columns-4">
        {photos.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setSelected(index)}
            className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-muted text-left"
          >
            <img
              src={item.url}
              alt={`Runway photograph ${item.number}`}
              width={item.width}
              height={item.height}
              loading="lazy"
              className="h-auto w-full transition duration-700 group-hover:scale-[1.025]"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-4 pt-16 text-white opacity-0 transition group-hover:opacity-100">
              <span className="label-mono">{item.number}</span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-black">
                <ShoppingBag size={15} />
              </span>
            </span>
          </button>
        ))}
      </section>
      <footer className="flex flex-col gap-3 border-t px-5 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10">
        <span>© 2026 Atelier Nord Photography</span>
        <span className="label-mono">Archival prints · Made to order</span>
      </footer>
      {photo && (
        <div className="fixed inset-0 z-50 bg-viewer text-viewer-foreground">
          <div className="absolute inset-0 flex items-center justify-center p-4 pb-24 pt-20 md:p-20">
            <img
              src={photo.url}
              alt={photo.number}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 md:p-6">
            <span className="label-mono">
              {photo.number} · {selected! + 1}/{photos.length}
            </span>
            <button
              onClick={() => {
                setSelected(null);
                setOrdering(false);
              }}
              className="viewer-button"
              aria-label="Close"
            >
              <X />
            </button>
          </div>
          <button
            onClick={() => setSelected((selected! - 1 + photos.length) % photos.length)}
            className="viewer-button absolute left-3 top-1/2 md:left-6"
            aria-label="Previous"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => setSelected((selected! + 1) % photos.length)}
            className="viewer-button absolute right-3 top-1/2 md:right-6"
            aria-label="Next"
          >
            <ChevronRight />
          </button>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-4 md:p-6">
            <button
              onClick={() =>
                setFavorites((ids) =>
                  ids.includes(photo.id) ? ids.filter((id) => id !== photo.id) : [...ids, photo.id],
                )
              }
              className="viewer-button"
              aria-label="Favorite"
            >
              <Heart className={favorites.includes(photo.id) ? "fill-current text-red-400" : ""} />
            </button>
            {event.downloadsEnabled && (
              <a href={photo.url} download className="viewer-button" aria-label="Download">
                <Download />
              </a>
            )}
            <button
              onClick={() => setOrdering(true)}
              className="ml-2 rounded-full bg-white px-7 py-4 font-mono text-xs uppercase tracking-[.2em] text-black transition hover:bg-primary hover:text-white"
            >
              Order this print
            </button>
          </div>
          {ordering && (
            <div
              className="absolute inset-0 z-10 flex justify-end bg-black/55"
              onClick={() => setOrdering(false)}
            >
              <aside
                className="h-full w-full overflow-y-auto bg-background text-foreground sm:max-w-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 p-5 backdrop-blur">
                  <div>
                    <p className="label-mono text-primary">Configure print</p>
                    <h2 className="font-display text-3xl">{photo.number}</h2>
                  </div>
                  <button onClick={() => setOrdering(false)} className="icon-button">
                    <X />
                  </button>
                </div>
                <div className="p-5 md:p-8">
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-muted p-5">
                    <img
                      src={photo.url}
                      alt="Selected print preview"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="mt-7">
                    <p className="label-mono">{product.name}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {product.description}
                    </p>
                  </div>
                  <div className="mt-7">
                    <p className="label-mono mb-3">Select size</p>
                    <div className="grid grid-cols-3 gap-2">
                      {product.variants.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setVariantId(v.id)}
                          className={`rounded-xl border p-3 text-left transition ${variantId === v.id ? "border-primary bg-accent ring-1 ring-primary" : "bg-card hover:border-foreground/30"}`}
                        >
                          <span className="block font-medium">{v.label}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatCents(v.priceCents)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-7 flex items-center justify-between border-y py-5">
                    <span className="label-mono">Quantity</span>
                    <div className="flex items-center gap-4">
                      <button
                        className="icon-button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        −
                      </button>
                      <span>{quantity}</span>
                      <button className="icon-button" onClick={() => setQuantity(quantity + 1)}>
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={add}
                    className="mt-6 flex w-full items-center justify-between rounded-full bg-foreground px-6 py-4 text-white"
                  >
                    <span className="label-mono">Add to cart</span>
                    <span>{formatCents(variant.priceCents * quantity)}</span>
                  </button>
                  <Link
                    to="/cart"
                    className="mt-3 block text-center text-xs text-muted-foreground underline"
                  >
                    View cart
                  </Link>
                </div>
              </aside>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
