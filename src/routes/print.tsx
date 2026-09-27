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
import { loadPrintCatalog, findFinish, findProduct, findSize, MOUNTING_IDS, resolveMounting, unitPriceCents, type PrintCatalog } from "@/lib/print-catalog";
import { DEFAULT_CROP_X, DEFAULT_CROP_Y } from "@/lib/print-preview";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/print")({ component: UploadPrintHome });

const UPLOAD_EVENT_SLUG = "customer-uploads";

function UploadPrintHome() {
  const [photos, setPhotos] = useState<StoredCustomerPhoto[]>([]);
  const [catalog, setCatalog] = useState<PrintCatalog | null>(null);
  const [configureId, setConfigureId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [finishId, setFinishId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [border, setBorder] = useState(false);
  const [mountingId, setMountingId] = useState<string>(MOUNTING_IDS.printOnly);
  const [quantity, setQuantity] = useState(1);
  const [cropX, setCropX] = useState(DEFAULT_CROP_X);
  const [cropY, setCropY] = useState(DEFAULT_CROP_Y);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addItem } = useCart();

  const loadPhotos = useCallback(async () => {
    setPhotos(await listCustomerPhotos());
  }, []);

  useEffect(() => {
    void loadPhotos();
    void loadPrintCatalog().then(setCatalog);
  }, [loadPhotos]);

  function resetCrop() {
    setCropX(DEFAULT_CROP_X);
    setCropY(DEFAULT_CROP_Y);
  }

  function openConfigure(id: string) {
    setConfigureId(id);
    setProductId(null);
    setFinishId(null);
    setSizeId(null);
    setBorder(false);
    setMountingId(MOUNTING_IDS.printOnly);
    setQuantity(1);
    resetCrop();
  }

  function selectProduct(id: string) {
    setProductId(id);
    setFinishId(null);
    setSizeId(null);
    setBorder(false);
    setMountingId(MOUNTING_IDS.printOnly);
    resetCrop();
  }

  function selectFinish(id: string) {
    setFinishId(id);
    setSizeId(null);
    setBorder(false);
    setMountingId(MOUNTING_IDS.printOnly);
    resetCrop();
  }

  function selectSize(id: string) {
    setSizeId(id);
    setMountingId(MOUNTING_IDS.printOnly);
    resetCrop();
  }

  function onCropChange(nextX: number, nextY: number) {
    setCropX(nextX);
    setCropY(nextY);
  }

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
  const product = findProduct(catalog ?? { products: [] }, productId);
  const finish = findFinish(product, finishId);
  const size = findSize(finish, sizeId);

  function addToCart() {
    if (!active || !product || !finish || !size || size.priceCents == null) return;
    const mounting = resolveMounting(size.label, mountingId);
    if (!mounting) return;
    const printPriceCents = size.priceCents;
    const mountingPriceCents = mounting.priceCents;
    addItem({
      photoId: active.id,
      photoNumber: active.number,
      photoUrl: active.previewUrl,
      photoWidth: active.width,
      photoHeight: active.height,
      eventSlug: UPLOAD_EVENT_SLUG,
      productId: product.id,
      productName: product.name,
      finishId: finish.id,
      finishName: finish.name,
      productVariantId: size.id,
      sizeLabel: size.label,
      border,
      mountingId: mounting.id,
      mountingName: mounting.name,
      printPriceCents,
      mountingPriceCents,
      unitPriceCents: unitPriceCents(printPriceCents, mountingPriceCents),
      quantity,
      cropX,
      cropY,
    });
    toast.success(`${active.number} · ${size.label} added to cart`);
    setConfigureId(null);
    setProductId(null);
    setFinishId(null);
    setSizeId(null);
    setBorder(false);
    setMountingId(MOUNTING_IDS.printOnly);
    setQuantity(1);
    resetCrop();
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <section className="px-5 pb-10 pt-10 md:px-10 md:pb-16 md:pt-16">
        <h1 className="max-w-3xl font-display text-5xl leading-[.92] tracking-[-.04em] md:text-7xl">
          Upload. Choose a product and size. Order.
        </h1>
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
        <section className="px-5 pb-16 pt-10 md:px-10">
          <p className="mb-6 text-sm text-muted-foreground">
            Click on a photo to choose the product and size.
          </p>
          <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4">
          {photos.map((item) => (
            <article
              key={item.id}
              className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-muted"
            >
              <button
                type="button"
                onClick={() => openConfigure(item.id)}
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
          </div>
        </section>
      )}

      <footer className="flex flex-col gap-3 border-t px-5 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10">
        <span>© 2026 Dynasty Pix</span>
        <span className="label-mono">Photographic prints · Made to order</span>
      </footer>

      {active && catalog && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/55"
          onClick={() => setConfigureId(null)}
        >
          <aside
            className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground sm:max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <PrintConfigurePanel
              photoNumber={active.number}
              photoUrl={active.previewUrl}
              photoWidth={active.width}
              photoHeight={active.height}
              catalog={catalog}
              productId={productId}
              finishId={finishId}
              sizeId={sizeId}
              border={border}
              mountingId={mountingId}
              quantity={quantity}
              cropX={cropX}
              cropY={cropY}
              onProductId={selectProduct}
              onFinishId={selectFinish}
              onSizeId={selectSize}
              onBorder={setBorder}
              onMountingId={setMountingId}
              onQuantity={setQuantity}
              onCropChange={onCropChange}
              onClose={() => setConfigureId(null)}
              onAdd={addToCart}
            />
          </aside>
        </div>
      )}
    </main>
  );
}
