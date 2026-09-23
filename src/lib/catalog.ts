export type GalleryPhoto = {
  id: string;
  number: string;
  url: string;
  width: number;
  height: number;
};
export const event = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "runway72026",
  title: "Runway 7, 2026",
  date: "March 14, 2026",
  location: "Paris",
  description: "Archival frames from the front row.",
  downloadsEnabled: true,
};
export const photos: GalleryPhoto[] = (
  [
    ["021", 1200, 1600],
    ["034", 900, 1200],
    ["046", 900, 1200],
    ["088", 1600, 1000],
    ["102", 900, 700],
    ["118", 900, 1200],
    ["134", 1200, 1600],
    ["150", 1600, 1000],
  ] as const
).map(([number, width, height]) => ({
  id: `photo-n07-${number}`,
  number: `N07_${number}`,
  url: `/photos/n07_${number}.jpg`,
  width,
  height,
}));
const rows: Array<[string, number, number, number]> = [
  ["4x6", 4, 6, 900],
  ["5x7", 5, 7, 1400],
  ["8x10", 8, 10, 1800],
  ["8x12", 8, 12, 2200],
  ["10x10", 10, 10, 2400],
  ["10x20", 10, 20, 5200],
  ["11x14", 11, 14, 2800],
  ["12x18", 12, 18, 4000],
  ["16x20", 16, 20, 4600],
  ["16x24", 16, 24, 5600],
  ["20x24", 20, 24, 6800],
  ["20x30", 20, 30, 7800],
];
export const product = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Photographic Print",
  category: "Prints",
  description: "Archival lustre photographic paper, printed to order.",
  variants: rows.map(([label, width, height, priceCents]) => ({
    id: `variant-${label}`,
    label,
    width,
    height,
    priceCents,
  })),
};
export const studio = {
  name: "Dynasty Pix",
  address: "118 Rue Saint-Maur",
  cityLine: "Paris, IDF 75011",
  country: "France",
  taxRate: 0.08,
};
export const shippingMethods = [
  { code: "standard", name: "Standard Shipping", detail: "5–7 business days", priceCents: 995 },
  { code: "expedited", name: "Expedited Shipping", detail: "2–3 business days", priceCents: 2295 },
];
