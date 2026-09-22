/**
 * Fulfillment abstraction.
 *
 * Printing/fulfillment is deliberately decoupled from checkout and the order
 * tables. Checkout only calls `getFulfillmentProvider().submitOrder(...)` and
 * stores the returned provider name + reference on the order row, so a real lab
 * (WHCC, another lab, an in-house pipeline) can be added later by adding one
 * provider object below — no checkout or schema rewrite required.
 */

export type FulfillmentLineItem = {
  photoId: string;
  photoNumber: string;
  originalPath: string | null;
  productName: string;
  sizeLabel: string;
  quantity: number;
};

export type FulfillmentRequest = {
  orderNumber: string;
  fulfillmentMethod: "shipping" | "studio_pickup";
  shippingMethodCode: string | null;
  items: FulfillmentLineItem[];
  shipTo: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
};

export type FulfillmentResult = {
  provider: string;
  reference: string | null;
};

export type FulfillmentProvider = {
  name: string;
  submitOrder: (request: FulfillmentRequest) => Promise<FulfillmentResult>;
};

/** Studio prints in-house; the order simply enters the studio production queue. */
const manualStudioProvider: FulfillmentProvider = {
  name: "manual_studio",
  async submitOrder(request) {
    console.info("[fulfillment] queued for studio production", {
      orderNumber: request.orderNumber,
      method: request.fulfillmentMethod,
      lines: request.items.length,
    });
    return { provider: "manual_studio", reference: `STUDIO-${request.orderNumber}` };
  },
};

const providers: Record<string, FulfillmentProvider> = {
  manual_studio: manualStudioProvider,
};

export function getFulfillmentProvider(): FulfillmentProvider {
  const configured = process.env["FULFILLMENT_PROVIDER"] ?? "manual_studio";
  return providers[configured] ?? manualStudioProvider;
}
