import { studio, shippingMethods } from "@/lib/catalog";

/** A printable size for a specific product + finish. */
export type PrintSizeOption = {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Null when pricing has not been supplied yet — never invent prices. */
  priceCents: number | null;
};

export type PrintFinish = {
  id: string;
  name: string;
  sizes: PrintSizeOption[];
};

export type PrintProductType = {
  id: string;
  name: string;
  description: string;
  finishes: PrintFinish[];
};

export type PrintCatalog = {
  products: PrintProductType[];
};

/** @deprecated Prefer PrintSizeOption — kept for preview helper typing. */
export type PrintVariant = {
  id: string;
  label: string;
  width: number;
  height: number;
  priceCents: number;
};

/** @deprecated Prefer PrintProductType in the new catalog tree. */
export type PrintProduct = {
  id: string;
  name: string;
  description: string;
  variants: PrintVariant[];
};

export const PHOTOGRAPHIC_PRINT_ID = "11111111-1111-4111-8111-111111111111";
export const FINE_ART_PRINT_ID = "22222222-2222-4222-8222-222222222221";

export const FINISH_IDS = {
  lustre: "lustre",
  deepMatte: "deep-matte",
  pearl: "pearl",
  smoothMatte: "smooth-matte",
  aquarelleRag: "aquarelle-rag",
  torchon: "torchon",
} as const;

/** Default preview frame before a size is chosen (aspect only). */
export const DEFAULT_PREVIEW_SIZE = { width: 8, height: 10 } as const;

/**
 * Client spreadsheet pricing (source of truth).
 * Amounts are USD dollars — converted to cents when building sizes.
 * "Wallets (8)" is intentionally omitted: no safe single width/height for crop/DPI.
 */
type PriceRow = readonly [label: string, dollars: number];

const PHOTOGRAPHIC_LUSTRE: PriceRow[] = [
  ["4x6", 4],
  ["5x7", 6],
  ["4x10", 7.5],
  ["8x10", 12],
  ["9x12", 19.5],
  ["11x14", 26.5],
  ["12x24", 55],
  ["15x30", 85],
  ["16x20", 55],
  ["16x24", 75],
  ["20x24", 85],
  ["24x36", 175],
];

const PHOTOGRAPHIC_DEEP_MATTE: PriceRow[] = [
  ["4x6", 5],
  ["5x7", 8],
  ["4x10", 9],
  ["8x10", 16],
  ["9x12", 25.5],
  ["11x14", 35],
  ["12x24", 72],
  ["15x30", 110],
  ["16x20", 72],
  ["16x24", 98],
  ["20x24", 110],
  ["24x36", 225],
];

const PHOTOGRAPHIC_PEARL: PriceRow[] = [
  ["4x6", 4.5],
  ["5x7", 7],
  ["4x10", 8],
  ["8x10", 14],
  ["9x12", 22],
  ["11x14", 30],
  ["12x24", 62],
  ["15x30", 96],
  ["16x20", 62],
  ["16x24", 84],
  ["20x24", 95],
  ["24x36", 195],
];

const FINE_ART_SMOOTH_MATTE: PriceRow[] = [
  ["4x6", 4],
  ["5x7", 6],
  ["8x10", 12],
  ["9x12", 19.5],
  ["11x14", 26.5],
  ["12x24", 55],
  ["15x30", 85],
  ["16x20", 55],
  ["16x24", 75],
  ["20x24", 85],
];

const FINE_ART_AQUARELLE_RAG: PriceRow[] = [
  ["4x6", 6],
  ["5x7", 9],
  ["8x10", 18],
  ["9x12", 29.5],
  ["11x14", 40],
  ["12x24", 82.5],
  ["15x30", 127.5],
  ["16x20", 82.5],
  ["16x24", 112.5],
  ["20x24", 127.5],
];

const FINE_ART_TORCHON: PriceRow[] = [
  ["4x6", 6],
  ["5x7", 9],
  ["8x10", 18],
  ["9x12", 29.5],
  ["11x14", 40],
  ["12x24", 82.5],
  ["15x30", 127.5],
  ["16x20", 82.5],
  ["16x24", 112.5],
  ["20x24", 127.5],
];

function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function parseSizeLabel(label: string): { width: number; height: number } {
  const match = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(label);
  if (!match) {
    throw new Error(`Unsupported print size label for crop/DPI: ${label}`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

function sizeId(productId: string, finishId: string, label: string) {
  return `${productId}:${finishId}:${label}`;
}

function sizesFor(
  productId: string,
  finishId: string,
  rows: PriceRow[],
): PrintSizeOption[] {
  return rows.map(([label, dollars]) => {
    const { width, height } = parseSizeLabel(label);
    return {
      id: sizeId(productId, finishId, label),
      label,
      width,
      height,
      priceCents: dollarsToCents(dollars),
    };
  });
}

function buildStaticCatalog(): PrintCatalog {
  return {
    products: [
      {
        id: PHOTOGRAPHIC_PRINT_ID,
        name: "Photographic Print",
        description: "Archival photographic paper, printed to order.",
        finishes: [
          {
            id: FINISH_IDS.lustre,
            name: "Lustre",
            sizes: sizesFor(PHOTOGRAPHIC_PRINT_ID, FINISH_IDS.lustre, PHOTOGRAPHIC_LUSTRE),
          },
          {
            id: FINISH_IDS.deepMatte,
            name: "Deep Matte",
            sizes: sizesFor(PHOTOGRAPHIC_PRINT_ID, FINISH_IDS.deepMatte, PHOTOGRAPHIC_DEEP_MATTE),
          },
          {
            id: FINISH_IDS.pearl,
            name: "Pearl",
            sizes: sizesFor(PHOTOGRAPHIC_PRINT_ID, FINISH_IDS.pearl, PHOTOGRAPHIC_PEARL),
          },
        ],
      },
      {
        id: FINE_ART_PRINT_ID,
        name: "Fine Art Print",
        description: "Museum-quality fine art papers, printed to order.",
        finishes: [
          {
            id: FINISH_IDS.smoothMatte,
            name: "Smooth Matte",
            sizes: sizesFor(FINE_ART_PRINT_ID, FINISH_IDS.smoothMatte, FINE_ART_SMOOTH_MATTE),
          },
          {
            id: FINISH_IDS.aquarelleRag,
            name: "Aquarelle Rag",
            sizes: sizesFor(FINE_ART_PRINT_ID, FINISH_IDS.aquarelleRag, FINE_ART_AQUARELLE_RAG),
          },
          {
            id: FINISH_IDS.torchon,
            name: "Torchon",
            sizes: sizesFor(FINE_ART_PRINT_ID, FINISH_IDS.torchon, FINE_ART_TORCHON),
          },
        ],
      },
    ],
  };
}

/** Server + client source of truth (sync). */
export function getPrintCatalog(): PrintCatalog {
  return buildStaticCatalog();
}

export type ResolvedPrintSku = {
  catalogId: string;
  productId: string;
  productName: string;
  finishId: string;
  finishName: string;
  sizeLabel: string;
  width: number;
  height: number;
  priceCents: number;
  displayName: string;
};

/** Flat priced SKUs for DB seeding and order validation. */
export function listPricedSkus(catalog: PrintCatalog = getPrintCatalog()): ResolvedPrintSku[] {
  const skus: ResolvedPrintSku[] = [];
  for (const product of catalog.products) {
    for (const finish of product.finishes) {
      for (const size of finish.sizes) {
        if (size.priceCents == null) continue;
        skus.push({
          catalogId: size.id,
          productId: product.id,
          productName: product.name,
          finishId: finish.id,
          finishName: finish.name,
          sizeLabel: size.label,
          width: size.width,
          height: size.height,
          priceCents: size.priceCents,
          displayName: `${product.name} · ${finish.name}`,
        });
      }
    }
  }
  return skus;
}

export function findPrintSku(
  productId: string,
  finishId: string,
  sizeLabel: string,
): ResolvedPrintSku | null {
  return (
    listPricedSkus().find(
      (sku) =>
        sku.productId === productId &&
        sku.finishId === finishId &&
        sku.sizeLabel === sizeLabel,
    ) ?? null
  );
}

/**
 * Resolve a cart/catalog variant id (`productId:finishId:sizeLabel`) to a priced SKU.
 * Returns null for unknown or unpriced combinations.
 */
export function resolvePrintSku(catalogId: string): ResolvedPrintSku | null {
  const parts = catalogId.split(":");
  if (parts.length !== 3) return null;
  const [productId, finishId, sizeLabel] = parts;
  if (!productId || !finishId || !sizeLabel) return null;
  return findPrintSku(productId, finishId, sizeLabel);
}

/** Client spreadsheet is the pricing source of truth for the configurator. */
export async function loadPrintCatalog(): Promise<PrintCatalog> {
  return getPrintCatalog();
}

/** @deprecated Use loadPrintCatalog — returns Lustre sizes as a flat product for older callers. */
export async function loadPrintProduct(): Promise<PrintProduct> {
  const catalog = await loadPrintCatalog();
  const photographic = catalog.products.find((p) => p.id === PHOTOGRAPHIC_PRINT_ID)!;
  const lustre = photographic.finishes.find((f) => f.id === FINISH_IDS.lustre)!;
  return {
    id: photographic.id,
    name: photographic.name,
    description: photographic.description,
    variants: lustre.sizes
      .filter((s): s is PrintSizeOption & { priceCents: number } => s.priceCents != null)
      .map((s) => ({
        id: s.id,
        label: s.label,
        width: s.width,
        height: s.height,
        priceCents: s.priceCents,
      })),
  };
}

export function findProduct(
  catalog: PrintCatalog,
  productId: string | null,
): PrintProductType | undefined {
  if (!productId) return undefined;
  return catalog.products.find((p) => p.id === productId);
}

export function findFinish(
  product: PrintProductType | undefined,
  finishId: string | null,
): PrintFinish | undefined {
  if (!product || !finishId) return undefined;
  return product.finishes.find((f) => f.id === finishId);
}

export function findSize(
  finish: PrintFinish | undefined,
  sizeId: string | null,
): PrintSizeOption | undefined {
  if (!finish || !sizeId) return undefined;
  return finish.sizes.find((s) => s.id === sizeId);
}

export function pricedSizes(finish: PrintFinish | undefined): PrintSizeOption[] {
  if (!finish) return [];
  return finish.sizes.filter((s) => s.priceCents != null);
}

/** White border inset on each side of the print (inches). */
export const PRINT_BORDER_INCHES = 0.375;

export const MOUNTING_IDS = {
  printOnly: "print-only",
  matboard: "matboard",
  blackFoamboard: "black-foamboard",
  whiteFoamboard: "white-foamboard",
} as const;

export type MountingId = (typeof MOUNTING_IDS)[keyof typeof MOUNTING_IDS];

export type MountingOption = {
  id: MountingId;
  name: string;
  priceCents: number;
};

/**
 * Mounting add-on prices by print size (USD dollars).
 * `null` = unavailable for that size. Print Only is always $0 and always available.
 */
const MOUNTING_BY_SIZE: Record<
  string,
  { matboard: number | null; blackFoamboard: number | null; whiteFoamboard: number | null }
> = {
  "4x6": { matboard: 13, blackFoamboard: 10.5, whiteFoamboard: 10.5 },
  "5x7": { matboard: 13, blackFoamboard: 16.5, whiteFoamboard: 16.5 },
  "4x10": { matboard: 13, blackFoamboard: null, whiteFoamboard: null },
  "8x10": { matboard: 13, blackFoamboard: 18, whiteFoamboard: 18 },
  "9x12": { matboard: 21.5, blackFoamboard: 25, whiteFoamboard: 25 },
  "11x14": { matboard: 21.5, blackFoamboard: 25, whiteFoamboard: 25 },
  "12x24": { matboard: null, blackFoamboard: 51.5, whiteFoamboard: 51.5 },
  "15x30": { matboard: null, blackFoamboard: 53.5, whiteFoamboard: 53.5 },
  "16x20": { matboard: 30.5, blackFoamboard: 35, whiteFoamboard: 35 },
  "16x24": { matboard: null, blackFoamboard: 51.5, whiteFoamboard: 51.5 },
  "20x24": { matboard: null, blackFoamboard: 51.5, whiteFoamboard: 51.5 },
  "24x36": { matboard: null, blackFoamboard: 79.5, whiteFoamboard: 79.5 },
};

function dollarsToMountingCents(dollars: number | null): number | null {
  if (dollars == null) return null;
  return Math.round(dollars * 100);
}

/** Available mounting choices for a size label (includes Print Only). */
export function mountingOptionsForSize(sizeLabel: string): MountingOption[] {
  const row = MOUNTING_BY_SIZE[sizeLabel];
  const options: MountingOption[] = [
    { id: MOUNTING_IDS.printOnly, name: "Print Only", priceCents: 0 },
  ];
  if (!row) return options;

  const matboard = dollarsToMountingCents(row.matboard);
  if (matboard != null) {
    options.push({ id: MOUNTING_IDS.matboard, name: "Matboard", priceCents: matboard });
  }
  const black = dollarsToMountingCents(row.blackFoamboard);
  if (black != null) {
    options.push({
      id: MOUNTING_IDS.blackFoamboard,
      name: 'Black Foamboard 1/4"',
      priceCents: black,
    });
  }
  const white = dollarsToMountingCents(row.whiteFoamboard);
  if (white != null) {
    options.push({
      id: MOUNTING_IDS.whiteFoamboard,
      name: 'White Foamboard 1/4"',
      priceCents: white,
    });
  }
  return options;
}

export function resolveMounting(
  sizeLabel: string,
  mountingId: string,
): MountingOption | null {
  return mountingOptionsForSize(sizeLabel).find((option) => option.id === mountingId) ?? null;
}

export function unitPriceCents(printPriceCents: number, mountingPriceCents: number): number {
  return printPriceCents + mountingPriceCents;
}

export { studio, shippingMethods };
