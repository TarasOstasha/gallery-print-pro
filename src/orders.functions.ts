import { createServerFn } from "@tanstack/react-start";
import type { CreateOrderInput, CreateOrderResult } from "@/server/orders.server";
import { buildLocalOrder, createOrderInDatabase } from "@/server/orders.server";

export const placeOrder = createServerFn({ method: "POST" })
  .validator((data: CreateOrderInput) => data)
  .handler(async ({ data }): Promise<CreateOrderResult> => {
    try {
      return await createOrderInDatabase(data);
    } catch (error) {
      console.error("[placeOrder] Database order failed:", error);
      // Last-resort offline fallback so checkout is never a dead end in demos.
      return buildLocalOrder(data);
    }
  });
