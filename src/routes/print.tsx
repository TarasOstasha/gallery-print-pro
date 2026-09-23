import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, ShoppingBag, Trash2, Upload } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PrintConfigurePanel } from "@/components/print-configure-panel";
import {
  listCustomerPhotos,
  removeCustomerPhoto,
  saveCustomerPhoto,
  type StoredCustomerPhoto,
} from "@/lib/customer-photos";
import { loadPrintProduct, type PrintProduct } from "@/lib/print-catalog";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/print")({ component: UploadPrintHome });

const UPLOAD_EVENT_SLUG = "customer-uploads";

function UploadPrintHome() {
  const [photos, setPhotos] = useState<StoredCustomerPhoto[]>([]);
  const [product, setProduct] = useState<PrintProduct | null>(null);
  const [configureId, setConfigureId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addItem } = useCart();

  const loadPhotos = useCallback(async () => {
    setPhotos(await listCustomerPhotos());
  }, []);

  useEffect(() => {
    void loadPhotos();
    void loadPrintProduct().then((p) => {
      setProduct(p);
      setVariantId(p.variants[2]?.id ?? p.variants[0]?.id ?? "");
    });
  }, [loadPhotos]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        await saveCustomerPhoto(file);
      }
      await loadPhotos();
      toast.success("Photos added");
    } catch {
      toast.error("Could not process one or more photos");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove(id: string) {
    await removeCustomerPhoto(id);
    if (configureId === id) setConfigureId(null);
    await loadPhotos();
  }

  const active = configureId ? photos.find((p) => p.id === configureId) : null;
  const variant = product?.variants.find((v) => v.id === variantId);

  function addToCart() {
    if (!active || !product || !variant) return;
    addItem({
      photoId: active.id,
      photoNumber: active.number,
      photoUrl: active.previewUrl,
      photoWidth: active.width,
      photoHeight: active.height,
      eventSlug: UPLOAD_EVENT_SLUG,
      productId: product.id,
      productName: product.name,
      productVariantId: variant.id,
      sizeLabel: variant.label,
      unitPriceCents: variant.priceCents,
      quantity,
    });
    toast.success(`${active.number} · ${variant.label} added to cart`);
    setConfigureId(null);
    setQuantity(1);
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <section className="px-5 pb-10 pt-10 md:px-10 md:pb-16 md:pt-16">
        <p className="label-mono text-primary">Print your photos</p>
        <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <h1 className="max-w-3xl font-display text-5xl leading-[.92] tracking-[-.04em] md:text-7xl">
            Upload. Choose a size. <span className="italic text-primary">Order.</span>
          </h1>
          <p className="max-w-sm pb-2 text-sm leading-6 text-muted-foreground">
            Add your own photographs, pick a print size, and we&apos;ll produce archival lustre
            prints to order.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-10">
        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-muted-foreground/25 bg-card px-6 py-14 transition hover:border-primary/40 hover:bg-accent/30"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/*"
            multiple
            className="sr-only"
            onChange={(e) => void onFiles(e.target.files)}
          />
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            {uploading ? <Upload className="animate-pulse" /> : <ImagePlus />}
          </div>
          <p className="mt-5 font-display text-2xl">Drop photos here</p>
          <p className="mt-2 text-sm text-muted-foreground">or click to browse · JPG, PNG, WEBP</p>
        </label>
      </section>

      {photos.length > 0 && (
        <section className="columns-1 gap-3 px-3 pb-16 pt-10 sm:columns-2 lg:columns-3 xl:columns-4 md:px-10">
          {photos.map((item) => (
            <article
              key={item.id}
              className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-muted"
            >
              <button
                type="button"
                onClick={() => {
                  setConfigureId(item.id);
                  setQuantity(1);
                }}
                className="block w-full text-left"
              >
                <img
                  src={item.previewUrl}
                  alt={item.number}
                  width={item.width}
                  height={item.height}
                  className="h-auto w-full transition duration-700 group-hover:scale-[1.02]"
                />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-4 pt-16 text-white opacity-0 transition group-hover:opacity-100">
                  <span className="label-mono">{item.number}</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-black">
                    <ShoppingBag size={15} />
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void onRemove(item.id)}
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </section>
      )}

      <footer className="flex flex-col gap-3 border-t px-5 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10">
        <span>© 2026 Dynasty Pix</span>
        <span className="label-mono">Photographic prints · Made to order</span>
      </footer>

      {active && product && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/55"
          onClick={() => setConfigureId(null)}
        >
          <aside
            className="h-full w-full overflow-y-auto bg-background text-foreground sm:max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <PrintConfigurePanel
              photoNumber={active.number}
              photoUrl={active.previewUrl}
              photoWidth={active.width}
              photoHeight={active.height}
              product={product}
              variantId={variantId}
              quantity={quantity}
              onVariantId={setVariantId}
              onQuantity={setQuantity}
              onClose={() => setConfigureId(null)}
              onAdd={addToCart}
            />
          </aside>
        </div>
      )}
    </main>
  );
}
