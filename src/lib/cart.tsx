import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MOUNTING_IDS, type MountingId } from "@/lib/print-catalog";

export type CartItem = {
  /** Stable key: photo + product variant + border + mounting. */
  key: string;
  photoId: string;
  photoNumber: string;
  photoUrl: string;
  eventSlug: string;
  /** Original upload dimensions for print quality checks */
  photoWidth?: number;
  photoHeight?: number;
  productId: string;
  productName: string;
  finishId: string;
  finishName: string;
  productVariantId: string;
  sizeLabel: string;
  border: boolean;
  mountingId: MountingId | string;
  mountingName: string;
  printPriceCents: number;
  mountingPriceCents: number;
  unitPriceCents: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  addItem: (item: Omit<CartItem, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  hydrated: boolean;
};

const STORAGE_KEY = "atelier-nord.cart.v2";

function cartItemKey(item: Omit<CartItem, "key">): string {
  return `${item.photoId}:${item.productVariantId}:${item.border ? "border" : "noborder"}:${item.mountingId}`;
}

function normalizeCartItem(raw: Partial<CartItem> & Pick<CartItem, "photoId" | "productVariantId" | "quantity" | "unitPriceCents">): CartItem | null {
  if (!raw.photoId || !raw.productVariantId) return null;
  const border = Boolean(raw.border);
  const mountingId = raw.mountingId || MOUNTING_IDS.printOnly;
  const mountingPriceCents = raw.mountingPriceCents ?? 0;
  const printPriceCents = raw.printPriceCents ?? Math.max(0, raw.unitPriceCents - mountingPriceCents);
  const item: Omit<CartItem, "key"> = {
    photoId: raw.photoId,
    photoNumber: raw.photoNumber ?? "",
    photoUrl: raw.photoUrl ?? "",
    eventSlug: raw.eventSlug ?? "customer-uploads",
    photoWidth: raw.photoWidth,
    photoHeight: raw.photoHeight,
    productId: raw.productId ?? "",
    productName: raw.productName ?? "",
    finishId: raw.finishId ?? "",
    finishName: raw.finishName ?? "",
    productVariantId: raw.productVariantId,
    sizeLabel: raw.sizeLabel ?? "",
    border,
    mountingId,
    mountingName: raw.mountingName ?? "Print Only",
    printPriceCents,
    mountingPriceCents,
    unitPriceCents: raw.unitPriceCents,
    quantity: raw.quantity,
  };
  return { ...item, key: cartItemKey(item) };
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const raw =
          window.localStorage.getItem(STORAGE_KEY) ??
          window.localStorage.getItem("atelier-nord.cart.v1");
        if (!raw) return;
        const parsed = JSON.parse(raw) as Array<Partial<CartItem>>;
        const { getCustomerPhotoPreviewUrl } = await import("@/lib/customer-photos");
        const refreshed = (
          await Promise.all(
            parsed.map(async (entry) => {
              const normalized = normalizeCartItem(
                entry as Partial<CartItem> &
                  Pick<CartItem, "photoId" | "productVariantId" | "quantity" | "unitPriceCents">,
              );
              if (!normalized) return null;
              if (!normalized.photoId.startsWith("photo-n07-")) {
                const url = await getCustomerPhotoPreviewUrl(normalized.photoId);
                if (url) return { ...normalized, photoUrl: url };
              }
              return normalized;
            }),
          )
        ).filter((entry): entry is CartItem => entry != null);
        setItems(refreshed);
      } catch {
        /* ignore malformed cart */
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "key">) => {
    const key = cartItemKey(item);
    setItems((current) => {
      const existing = current.find((entry) => entry.key === key);
      if (existing) {
        return current.map((entry) =>
          entry.key === key ? { ...entry, quantity: entry.quantity + item.quantity } : entry,
        );
      }
      return [...current, { ...item, key }];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((entry) => entry.key !== key)
        : current.map((entry) => (entry.key === key ? { ...entry, quantity } : entry)),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((current) => current.filter((entry) => entry.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((total, entry) => total + entry.quantity, 0);
    const subtotalCents = items.reduce(
      (total, entry) => total + entry.unitPriceCents * entry.quantity,
      0,
    );
    return { items, count, subtotalCents, addItem, setQuantity, removeItem, clear, hydrated };
  }, [items, addItem, setQuantity, removeItem, clear, hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
