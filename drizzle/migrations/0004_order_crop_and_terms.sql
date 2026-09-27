-- Persist per-line crop (object-position 0–100%) and order terms acceptance.

alter table public.order_items
  add column if not exists crop_x double precision not null default 50;

alter table public.order_items
  add column if not exists crop_y double precision not null default 50;

alter table public.orders
  add column if not exists terms_accepted boolean not null default false;

alter table public.orders
  add column if not exists terms_accepted_at timestamptz;
