-- Snapshot border + mounting details on order line items.
-- Mounting prices remain validated from src/lib/print-catalog.ts (not stored as separate SKUs).

alter table public.order_items
  add column if not exists has_border boolean not null default false;

alter table public.order_items
  add column if not exists mounting_code text not null default 'print-only';

alter table public.order_items
  add column if not exists mounting_price_cents integer not null default 0;

alter table public.order_items
  add column if not exists print_price_cents integer;
