import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { formatCents } from "@/lib/money";
import { resolutionWarning } from "@/lib/print-preview";
import type { PrintProduct, PrintVariant } from "@/lib/print-catalog";

type Props = {
  photoNumber: string;
  photoUrl: string;
  photoWidth: number;
  photoHeight: number;
  product: PrintProduct;
  variantId: string;
  quantity: number;
  onVariantId: (id: string) => void;
  onQuantity: (qty: number) => void;
  onClose: () => void;
  onAdd: () => void;
};

export function PrintConfigurePanel({
  photoNumber,
  photoUrl,
  photoWidth,
  photoHeight,
  product,
  variantId,
  quantity,
  onVariantId,
  onQuantity,
  onClose,
  onAdd,
}: Props) {
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0]!;
  const warning = resolutionWarning(
    photoWidth,
    photoHeight,
    variant.width,
    variant.height,
  );

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 p-5 backdrop-blur">
        <div>
          <p className="label-mono text-primary">Configure print</p>
          <h2 className="font-display text-3xl">{photoNumber}</h2>
        </div>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Close">
          <X />
        </button>
      </div>
      <div className="p-5 md:p-8">
        <PrintPreview photoUrl={photoUrl} variant={variant} />
        {warning && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
            {warning}
          </p>
        )}
        <div className="mt-7">
          <p className="label-mono">{product.name}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{product.description}</p>
        </div>
        <div className="mt-7">
          <p className="label-mono mb-3">Select size</p>
          <div className="grid grid-cols-3 gap-2">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onVariantId(v.id)}
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
          className="mt-6 flex w-full items-center justify-between rounded-full bg-foreground px-6 py-4 text-white"
        >
          <span className="label-mono">Add to cart</span>
          <span>{formatCents(variant.priceCents * quantity)}</span>
        </button>
        <Link to="/cart" className="mt-3 block text-center text-xs text-muted-foreground underline">
          View cart
        </Link>
      </div>
    </>
  );
}

function PrintPreview({ photoUrl, variant }: { photoUrl: string; variant: PrintVariant }) {
  const aspect = variant.width / variant.height;
  return (
    <div
      className="mx-auto flex max-h-[min(50vh,420px)] w-full items-center justify-center overflow-hidden rounded-2xl bg-muted p-5"
      style={{ aspectRatio: String(aspect) }}
    >
      <img
        src={photoUrl}
        alt="Print preview"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
