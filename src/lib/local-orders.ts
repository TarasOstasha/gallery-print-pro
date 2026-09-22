import type { CartItem } from "@/lib/cart";

export type LocalOrderRecord = {
  orderNumber: string;
  accessToken: string;
  fulfillment: "shipping" | "studio_pickup";
  shippingMethodCode: string | null;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  paymentStatus: "paid";
  orderStatus: "new";
  createdAt: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  shippingAddress: Record<string, string> | null;
  items: CartItem[];
};

const STORAGE_KEY = "atelier-nord.orders.v1";

export function saveLocalOrder(order: LocalOrderRecord): void {
  const all = listLocalOrders();
  all.unshift(order);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 100)));
  sessionStorage.setItem(
    `order-${order.orderNumber}`,
    JSON.stringify({
      number: order.orderNumber,
      accessToken: order.accessToken,
      fulfillment: order.fulfillment,
      total: order.totalCents,
      data: {
        firstName: order.customer.firstName,
        lastName: order.customer.lastName,
        email: order.customer.email,
        phone: order.customer.phone,
        ...(order.shippingAddress ?? {}),
      },
      items: order.items,
    }),
  );
}

export function listLocalOrders(): LocalOrderRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalOrderRecord[];
  } catch {
    return [];
  }
}

export function updateLocalOrderStatus(orderNumber: string, orderStatus: string): void {
  const all = listLocalOrders();
  const next = all.map((o) =>
    o.orderNumber === orderNumber ? { ...o, orderStatus } : o,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
