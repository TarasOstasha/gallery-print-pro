import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { formatCents } from "@/lib/money";
import { resolutionWarning } from "@/lib/print-preview";
import {
  DEFAULT_PREVIEW_SIZE,
  MOUNTING_IDS,
  PRINT_BORDER_INCHES,
  findFinish,
  findProduct,
  findSize,
  mountingOptionsForSize,
  pricedSizes,
  unitPriceCents,
  type MountingId,
  type PrintCatalog,
  type PrintSizeOption,
} from "@/lib/print-catalog";

type Props = {
  photoNumber: string;
  photoUrl: string;
  photoWidth: number;
  photoHeight: number;
  catalog: PrintCatalog;
  productId: string | null;
  finishId: string | null;
  sizeId: string | null;
  border: boolean;
  mountingId: MountingId | string;
  quantity: number;
  onProductId: (id: string) => void;
  onFinishId: (id: string) => void;
  onSizeId: (id: string) => void;
  onBorder: (value: boolean) => void;
  onMountingId: (id: string) => void;
  onQuantity: (qty: number) => void;
  onClose: () => void;
  onAdd: () => void;
};

const optionSelected = "border-primary bg-accent ring-1 ring-primary";
const optionIdle = "bg-card hover:border-foreground/30";

export function PrintConfigurePanel({
  photoNumber,
  photoUrl,
  photoWidth,
  photoHeight,
  catalog,
  productId,
  finishId,
  sizeId,
  border,
  mountingId,
  quantity,
  onProductId,
  onFinishId,
  onSizeId,
  onBorder,
  onMountingId,
  onQuantity,
  onClose,
  onAdd,
}: Props) {
  const product = findProduct(catalog, productId);
  const finish = findFinish(product, finishId);
  const size = findSize(finish, sizeId);
  const availableSizes = pricedSizes(finish);
  const mountingOptions = size ? mountingOptionsForSize(size.label) : [];
  const mounting =
    mountingOptions.find((option) => option.id === mountingId) ??
    mountingOptions.find((option) => option.id === MOUNTING_IDS.printOnly) ??
    null;

  const previewWidth = size?.width ?? DEFAULT_PREVIEW_SIZE.width;
  const previewHeight = size?.height ?? DEFAULT_PREVIEW_SIZE.height;
  const warning = size
    ? resolutionWarning(photoWidth, photoHeight, size.width, size.height)
    : null;

  const printPriceCents = size?.priceCents ?? null;
  const mountingPriceCents = mounting?.priceCents ?? 0;
  const lineUnitCents =
    printPriceCents != null ? unitPriceCents(printPriceCents, mountingPriceCents) : null;
  const canAdd = Boolean(size && printPriceCents != null && mounting);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b bg-background p-5">
        <div>
          <p className="label-mono text-primary">Configure print</p>
          <h2 className="font-display text-3xl">{photoNumber}</h2>
        </div>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Close">
          <X />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 md:p-8">
        <PrintPreview
          photoUrl={photoUrl}
          width={previewWidth}
          height={previewHeight}
          border={border}
        />
        {warning && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
            {warning}
          </p>
        )}

        <div className="mt-7">
          <p className="label-mono mb-3">Product type</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {catalog.products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onProductId(p.id)}
                className={`rounded-xl border p-3 text-left transition ${productId === p.id ? optionSelected : optionIdle}`}
              >
                <span className="block font-medium">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {product && (
          <div className="mt-7">
            <p className="label-mono mb-3">Finish</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {product.finishes.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onFinishId(f.id)}
                  className={`rounded-xl border p-3 text-left transition ${finishId === f.id ? optionSelected : optionIdle}`}
                >
                  <span className="block font-medium">{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {finish && (
          <div className="mt-7">
            <p className="label-mono mb-3">Select size</p>
            {availableSizes.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {availableSizes.map((s) => (
                  <SizeOptionButton
                    key={s.id}
                    size={s}
                    selected={sizeId === s.id}
                    onSelect={() => onSizeId(s.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-sm leading-6 text-muted-foreground">
                Sizes and pricing for {product?.name} · {finish.name} are not available yet.
              </p>
            )}
          </div>
        )}

        {size && (
          <div className="mt-7">
            <p className="label-mono mb-3">Border</p>
            <button
              type="button"
              onClick={() => onBorder(!border)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${border ? optionSelected : optionIdle}`}
            >
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border leading-none ${border ? "border-primary bg-primary text-white" : "border-foreground/25 bg-card"}`}
                aria-hidden
              >
                {border ? "✓" : ""}
              </span>
              <span className="font-medium leading-none">Add white border</span>
            </button>
          </div>
        )}

        {size && (
          <div className="mt-7">
            <p className="label-mono mb-3">Mounting</p>
            <div className="grid grid-cols-1 gap-2">
              {mountingOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onMountingId(option.id)}
                  className={`rounded-xl border p-3 text-left transition ${mountingId === option.id ? optionSelected : optionIdle}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium">{option.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {option.priceCents === 0 ? "Included" : `+${formatCents(option.priceCents)}`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-7 flex items-center justify-between border-y py-5">
          <span className="label-mono">Quantity</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="icon-button"
              onClick={() => onQuantity(Math.max(1, quantity - 1))}
            >
              −
            </button>
            <span>{quantity}</span>
            <button type="button" className="icon-button" onClick={() => onQuantity(quantity + 1)}>
              +
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="mt-6 flex w-full items-center justify-between rounded-full bg-foreground px-6 py-4 text-white disabled:opacity-40"
        >
          <span className="label-mono">Add to cart</span>
          <span>{canAdd && lineUnitCents != null ? formatCents(lineUnitCents * quantity) : "—"}</span>
        </button>
        <Link to="/cart" className="mt-3 block text-center text-xs text-muted-foreground underline">
          View cart
        </Link>
      </div>
    </div>
  );
}

function SizeOptionButton({
  size,
  selected,
  onSelect,
}: {
  size: PrintSizeOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border p-3 text-left transition ${selected ? optionSelected : optionIdle}`}
    >
      <span className="block font-medium">{size.label}</span>
      <span className="mt-1 block text-xs text-muted-foreground">
        {size.priceCents != null ? formatCents(size.priceCents) : "—"}
      </span>
    </button>
  );
}

function PrintPreview({
  photoUrl,
  width,
  height,
  border,
}: {
  photoUrl: string;
  width: number;
  height: number;
  border: boolean;
}) {
  const aspect = width / height;
  const insetTop = border ? `${(PRINT_BORDER_INCHES / height) * 100}%` : "0%";
  const insetSide = border ? `${(PRINT_BORDER_INCHES / width) * 100}%` : "0%";
  // Cap preview height so Product Type stays visible under the header on desktop/mobile.
  const maxPreviewPx = "min(28vh, 220px)";

  return (
    <div className="mx-auto flex w-full justify-center rounded-2xl bg-muted p-3">
      <div
        className={`relative max-w-full overflow-hidden ${border ? "bg-white" : "bg-transparent"}`}
        style={{
          aspectRatio: String(aspect),
          maxHeight: maxPreviewPx,
          width: `min(100%, calc(${maxPreviewPx} * ${aspect}))`,
          height: "auto",
        }}
      >
        <div
          className="absolute overflow-hidden"
          style={{
            top: insetTop,
            bottom: insetTop,
            left: insetSide,
            right: insetSide,
          }}
        >
          <img src={photoUrl} alt="Print preview" className="h-full w-full object-cover" />
        </div>
      </div>
    </div>
  );
}
