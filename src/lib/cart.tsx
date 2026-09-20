import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  /** Stable key: one photo + one product variant. */
  key: string;
  photoId: string;
  photoNumber: string;
  photoUrl: string;
  eventSlug: string;
  productId: string;
  productName: string;
  productVariantId: string;
  sizeLabel: string;
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

const STORAGE_KEY = "atelier-nord.cart.v1";

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore malformed cart */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "key">) => {
    const key = `${item.photoId}:${item.productVariantId}`;
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
