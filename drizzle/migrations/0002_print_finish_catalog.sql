-- Sync product_variants with print-catalog.ts (product → finish → size → price).
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
    '11111111-1111-4111-8111-111111111111'::uuid,
    'Photographic Print',
    'Prints',
    'Archival photographic paper, printed to order.',
    true,
    1
  ),
  (
    '22222222-2222-4222-8222-222222222221'::uuid,
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
where product_id = '11111111-1111-4111-8111-111111111111'::uuid
  and finish = 'lustre'
  and size_label <> all (array['4x6', '5x7', '4x10', '8x10', '9x12', '11x14', '12x24', '15x30', '16x20', '16x24', '20x24', '24x36']::text[]);

insert into public.product_variants (
  product_id, finish, size_label, width_in, height_in, price_cents, is_active, sort_order
) values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '4x6', 4, 6, 400, true, 1),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '5x7', 5, 7, 600, true, 2),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '4x10', 4, 10, 750, true, 3),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '8x10', 8, 10, 1200, true, 4),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '9x12', 9, 12, 1950, true, 5),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '11x14', 11, 14, 2650, true, 6),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '12x24', 12, 24, 5500, true, 7),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '15x30', 15, 30, 8500, true, 8),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '16x20', 16, 20, 5500, true, 9),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '16x24', 16, 24, 7500, true, 10),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '20x24', 20, 24, 8500, true, 11),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'lustre', '24x36', 24, 36, 17500, true, 12),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '4x6', 4, 6, 500, true, 13),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '5x7', 5, 7, 800, true, 14),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '4x10', 4, 10, 900, true, 15),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '8x10', 8, 10, 1600, true, 16),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '9x12', 9, 12, 2550, true, 17),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '11x14', 11, 14, 3500, true, 18),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '12x24', 12, 24, 7200, true, 19),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '15x30', 15, 30, 11000, true, 20),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '16x20', 16, 20, 7200, true, 21),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '16x24', 16, 24, 9800, true, 22),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '20x24', 20, 24, 11000, true, 23),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'deep-matte', '24x36', 24, 36, 22500, true, 24),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '4x6', 4, 6, 450, true, 25),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '5x7', 5, 7, 700, true, 26),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '4x10', 4, 10, 800, true, 27),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '8x10', 8, 10, 1400, true, 28),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '9x12', 9, 12, 2200, true, 29),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '11x14', 11, 14, 3000, true, 30),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '12x24', 12, 24, 6200, true, 31),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '15x30', 15, 30, 9600, true, 32),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '16x20', 16, 20, 6200, true, 33),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '16x24', 16, 24, 8400, true, 34),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '20x24', 20, 24, 9500, true, 35),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'pearl', '24x36', 24, 36, 19500, true, 36),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'smooth-matte', '4x6', 4, 6, 400, true, 37),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'smooth-matte', '5x7', 5, 7, 600, true, 38),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'smooth-matte', '8x10', 8, 10, 1200, true, 39),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'smooth-matte', '9x12', 9, 12, 1950, true, 40),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'smooth-matte', '11x14', 11, 14, 2650, true, 41),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'smooth-matte', '12x24', 12, 24, 5500, true, 42),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'smooth-matte', '15x30', 15, 30, 8500, true, 43),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'smooth-matte', '16x20', 16, 20, 5500, true, 44),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'smooth-matte', '16x24', 16, 24, 7500, true, 45),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'smooth-matte', '20x24', 20, 24, 8500, true, 46),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'aquarelle-rag', '4x6', 4, 6, 600, true, 47),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'aquarelle-rag', '5x7', 5, 7, 900, true, 48),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'aquarelle-rag', '8x10', 8, 10, 1800, true, 49),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'aquarelle-rag', '9x12', 9, 12, 2950, true, 50),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'aquarelle-rag', '11x14', 11, 14, 4000, true, 51),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'aquarelle-rag', '12x24', 12, 24, 8250, true, 52),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'aquarelle-rag', '15x30', 15, 30, 12750, true, 53),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'aquarelle-rag', '16x20', 16, 20, 8250, true, 54),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'aquarelle-rag', '16x24', 16, 24, 11250, true, 55),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'aquarelle-rag', '20x24', 20, 24, 12750, true, 56),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'torchon', '4x6', 4, 6, 600, true, 57),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'torchon', '5x7', 5, 7, 900, true, 58),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'torchon', '8x10', 8, 10, 1800, true, 59),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'torchon', '9x12', 9, 12, 2950, true, 60),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'torchon', '11x14', 11, 14, 4000, true, 61),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'torchon', '12x24', 12, 24, 8250, true, 62),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'torchon', '15x30', 15, 30, 12750, true, 63),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'torchon', '16x20', 16, 20, 8250, true, 64),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'torchon', '16x24', 16, 24, 11250, true, 65),
  ('22222222-2222-4222-8222-222222222221'::uuid, 'torchon', '20x24', 20, 24, 12750, true, 66)
on conflict (product_id, finish, size_label) do update
set
  width_in = excluded.width_in,
  height_in = excluded.height_in,
  price_cents = excluded.price_cents,
  is_active = true,
  sort_order = excluded.sort_order;
