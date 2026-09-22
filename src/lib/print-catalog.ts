import { product as staticProduct, studio, shippingMethods } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";

export type PrintVariant = {
  id: string;
  label: string;
  width: number;
  height: number;
  priceCents: number;
};

export type PrintProduct = {
  id: string;
  name: string;
  description: string;
  variants: PrintVariant[];
};

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

function fromStatic(): PrintProduct {
  return {
    id: staticProduct.id,
    name: staticProduct.name,
    description: staticProduct.description,
    variants: staticProduct.variants.map((v) => ({
      id: v.label,
      label: v.label,
      width: v.width,
      height: v.height,
      priceCents: v.priceCents,
    })),
  };
}

export async function loadPrintProduct(): Promise<PrintProduct> {
  try {
    const { data, error } = await supabase
      .from("product_variants")
      .select("id, size_label, width_in, height_in, price_cents, sort_order")
      .eq("product_id", PRODUCT_ID)
      .eq("is_active", true)
      .order("sort_order");

    if (error || !data?.length) return fromStatic();

    return {
      id: PRODUCT_ID,
      name: staticProduct.name,
      description: staticProduct.description,
      variants: data.map((row) => ({
        id: row.id,
        label: row.size_label,
        width: Number(row.width_in),
        height: Number(row.height_in),
        priceCents: row.price_cents,
      })),
    };
  } catch {
    return fromStatic();
  }
}

export { studio, shippingMethods };
