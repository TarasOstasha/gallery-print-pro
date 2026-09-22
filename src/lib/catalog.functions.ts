import { createServerFn } from "@tanstack/react-start";

export type GalleryPhoto = {
  id: string;
  photoNumber: string;
  previewUrl: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
};

export type CatalogVariant = {
  id: string;
  sizeLabel: string;
  widthIn: number | null;
  heightIn: number | null;
  priceCents: number;
};

export type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  variants: CatalogVariant[];
};

export type ShippingMethod = {
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  estimatedDays: string | null;
};

export type StudioSettings = {
  studioName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  pickupNote: string;
  taxRate: number;
};

export type GalleryEvent = {
  id: string;
  slug: string;
  title: string;
  eventDate: string | null;
  location: string | null;
  description: string | null;
  downloadsEnabled: boolean;
};

export const getGalleryData = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicServerClient } = await import("./supabase-public.server");
  const supabase = createPublicServerClient();

  const [eventRes, productsRes, shippingRes, studioRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, title, event_date, location, description, downloads_enabled")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("products")
      .select(
        "id, name, category, description, image_url, sort_order, product_variants(id, size_label, width_in, height_in, price_cents, is_active, sort_order)",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("shipping_methods")
      .select("code, name, description, price_cents, estimated_days")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("studio_settings").select("*").limit(1).maybeSingle(),
  ]);

  const event: GalleryEvent | null = eventRes.data
    ? {
        id: eventRes.data.id,
        slug: eventRes.data.slug,
        title: eventRes.data.title,
        eventDate: eventRes.data.event_date,
        location: eventRes.data.location,
        description: eventRes.data.description,
        downloadsEnabled: eventRes.data.downloads_enabled,
      }
    : null;

  let photos: GalleryPhoto[] = [];
  if (event) {
    const { data } = await supabase
      .from("photos")
      .select("id, photo_number, preview_url, thumb_url, width, height, caption")
      .eq("event_id", event.id)
      .order("sort_order", { ascending: true });
    photos = (data ?? []).map((row) => ({
      id: row.id,
      photoNumber: row.photo_number,
      previewUrl: row.preview_url,
      thumbUrl: row.thumb_url,
      width: row.width,
      height: row.height,
      caption: row.caption,
    }));
  }

  const products: CatalogProduct[] = (productsRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    imageUrl: row.image_url,
    variants: (row.product_variants ?? [])
      .filter((variant) => variant.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((variant) => ({
        id: variant.id,
        sizeLabel: variant.size_label,
        widthIn: variant.width_in === null ? null : Number(variant.width_in),
        heightIn: variant.height_in === null ? null : Number(variant.height_in),
        priceCents: variant.price_cents,
      })),
  }));

  const shippingMethods: ShippingMethod[] = (shippingRes.data ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    estimatedDays: row.estimated_days,
  }));

  const studio: StudioSettings | null = studioRes.data
    ? {
        studioName: studioRes.data.studio_name,
        addressLine1: studioRes.data.address_line1,
        addressLine2: studioRes.data.address_line2,
        city: studioRes.data.city,
        state: studioRes.data.state,
        postalCode: studioRes.data.postal_code,
        country: studioRes.data.country,
        pickupNote: studioRes.data.pickup_note,
        taxRate: Number(studioRes.data.tax_rate),
      }
    : null;

  return { event, photos, products, shippingMethods, studio };
});
