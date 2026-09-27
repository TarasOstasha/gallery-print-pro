import { writeFileSync } from "node:fs";
import { listPricedSkus, PHOTOGRAPHIC_PRINT_ID, FINE_ART_PRINT_ID } from "../src/lib/print-catalog.ts";

const skus = listPricedSkus();
const photoActive = [
  ...new Set(skus.filter((s) => s.productId === PHOTOGRAPHIC_PRINT_ID).map((s) => s.sizeLabel)),
];

const values = skus
  .map(
    (sku, i) =>
      `  ('${sku.productId}'::uuid, '${sku.finishId}', '${sku.sizeLabel}', ${sku.width}, ${sku.height}, ${sku.priceCents}, true, ${i + 1})`,
  )
  .join(",\n");

const sql = `-- Sync product_variants with print-catalog.ts (product → finish → size → price).
-- Source of truth: src/lib/print-catalog.ts

alter table public.product_variants
  add column if not exists finish text;

update public.product_variants
set finish = 'lustre'
where finish is null or finish = '';

alter table public.product_variants
  alter column finish set default 'lustre';

alter table public.product_variants
  alter column finish set not null;

alter table public.product_variants
  drop constraint if exists product_variants_product_id_size_label_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_product_finish_size_key'
  ) then
    alter table public.product_variants
      add constraint product_variants_product_finish_size_key
      unique (product_id, finish, size_label);
  end if;
end $$;

insert into public.products (id, name, category, description, is_active, sort_order)
values
  (
    '${PHOTOGRAPHIC_PRINT_ID}'::uuid,
    'Photographic Print',
    'Prints',
    'Archival photographic paper, printed to order.',
    true,
    1
  ),
  (
    '${FINE_ART_PRINT_ID}'::uuid,
    'Fine Art Print',
    'Prints',
    'Museum-quality fine art papers, printed to order.',
    true,
    2
  )
on conflict (id) do update
set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  is_active = true,
  sort_order = excluded.sort_order;

-- Retire photographic sizes that are no longer offered on any active finish.
update public.product_variants
set is_active = false
where product_id = '${PHOTOGRAPHIC_PRINT_ID}'::uuid
  and finish = 'lustre'
  and size_label <> all (array[${photoActive.map((l) => `'${l}'`).join(", ")}]::text[]);

insert into public.product_variants (
  product_id, finish, size_label, width_in, height_in, price_cents, is_active, sort_order
) values
${values}
on conflict (product_id, finish, size_label) do update
set
  width_in = excluded.width_in,
  height_in = excluded.height_in,
  price_cents = excluded.price_cents,
  is_active = true,
  sort_order = excluded.sort_order;
`;

writeFileSync(
  new URL("../drizzle/migrations/0002_print_finish_catalog.sql", import.meta.url),
  sql,
);
console.log(`Wrote migration with ${skus.length} SKUs`);
