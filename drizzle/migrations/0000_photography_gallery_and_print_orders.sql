-- ENUMS
create type public.app_role as enum ('admin','staff');
create type public.fulfillment_method as enum ('shipping','studio_pickup');
create type public.payment_status as enum ('pending','paid','failed','refunded');
create type public.order_status as enum ('new','processing','sent_to_lab','ready_for_pickup','shipped','completed','cancelled');

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can read their own roles" on public.user_roles
for select to authenticated using (auth.uid() = user_id);

-- STUDIO SETTINGS (single row)
create table public.studio_settings (
  id uuid primary key default gen_random_uuid(),
  studio_name text not null default 'Atelier Nord',
  address_line1 text not null default '118 Rue Saint-Maur',
  address_line2 text,
  city text not null default 'Paris',
  state text not null default 'IDF',
  postal_code text not null default '75011',
  country text not null default 'France',
  pickup_note text not null default 'We will notify you by email when your order is ready for pickup.',
  tax_rate numeric(6,4) not null default 0.0800,
  updated_at timestamptz not null default now()
);
grant select on public.studio_settings to anon, authenticated;
grant all on public.studio_settings to service_role;
alter table public.studio_settings enable row level security;
create policy "Studio settings are public" on public.studio_settings for select to anon, authenticated using (true);
create policy "Admins manage studio settings" on public.studio_settings for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- SHIPPING METHODS (structured so rates can later come from a carrier API)
create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_cents integer not null default 0,
  estimated_days text,
  is_active boolean not null default true,
  sort_order integer not null default 0
);
grant select on public.shipping_methods to anon, authenticated;
grant all on public.shipping_methods to service_role;
alter table public.shipping_methods enable row level security;
create policy "Active shipping methods are public" on public.shipping_methods for select to anon, authenticated using (is_active);
create policy "Admins manage shipping methods" on public.shipping_methods for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- EVENTS
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  event_date date,
  location text,
  description text,
  cover_photo_id uuid,
  is_published boolean not null default false,
  downloads_enabled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.events to anon, authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "Published events are public" on public.events for select to anon, authenticated using (is_published);
create policy "Admins read all events" on public.events for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins manage events" on public.events for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- PHOTOS
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  photo_number text not null,
  caption text,
  preview_url text not null,
  thumb_url text,
  original_path text,
  width integer,
  height integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, photo_number)
);
create index photos_event_sort_idx on public.photos (event_id, sort_order, created_at);
grant select on public.photos to anon, authenticated;
grant all on public.photos to service_role;
alter table public.photos enable row level security;
create policy "Photos of published events are public" on public.photos for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = photos.event_id and e.is_published));
create policy "Admins read all photos" on public.photos for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins manage photos" on public.photos for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

alter table public.events add constraint events_cover_photo_fkey
  foreign key (cover_photo_id) references public.photos(id) on delete set null;

-- PRODUCTS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Prints',
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "Active products are public" on public.products for select to anon, authenticated using (is_active);
create policy "Admins manage products" on public.products for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size_label text not null,
  width_in numeric(6,2),
  height_in numeric(6,2),
  price_cents integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  unique (product_id, size_label)
);
grant select on public.product_variants to anon, authenticated;
grant all on public.product_variants to service_role;
alter table public.product_variants enable row level security;
create policy "Active variants are public" on public.product_variants for select to anon, authenticated using (is_active);
create policy "Admins manage variants" on public.product_variants for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- CUSTOMERS
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  created_at timestamptz not null default now()
);
create unique index customers_email_key on public.customers (lower(email));
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "Admins read customers" on public.customers for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ORDERS
create sequence public.order_number_seq start 10248;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  access_token uuid not null default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  subtotal_cents integer not null default 0,
  shipping_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  fulfillment_method public.fulfillment_method not null,
  shipping_method_code text,
  payment_status public.payment_status not null default 'pending',
  order_status public.order_status not null default 'new',
  fulfillment_provider text not null default 'manual_studio',
  fulfillment_reference text,
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Admins read orders" on public.orders for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins update orders" on public.orders for update to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete restrict,
  product_variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null,
  line_total_cents integer not null,
  photo_number_snapshot text not null,
  product_name_snapshot text not null,
  size_label_snapshot text not null,
  created_at timestamptz not null default now()
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "Admins read order items" on public.order_items for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'United States',
  created_at timestamptz not null default now()
);
grant select on public.shipping_addresses to authenticated;
grant all on public.shipping_addresses to service_role;
alter table public.shipping_addresses enable row level security;
create policy "Admins read shipping addresses" on public.shipping_addresses for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'mock',
  provider_payment_id text,
  amount_cents integer not null,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "Admins read payments" on public.payments for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- SEED: shipping methods
insert into public.shipping_methods (code, name, description, price_cents, estimated_days, sort_order) values
  ('standard','Standard Shipping','Tracked ground delivery.',995,'5-7 business days',1),
  ('expedited','Expedited Shipping','Priority air delivery.',2295,'2-3 business days',2);

-- SEED: studio settings
insert into public.studio_settings (studio_name, address_line1, city, state, postal_code, country)
values ('Atelier Nord','118 Rue Saint-Maur','Paris','IDF','75011','France');

-- SEED: products + variants
insert into public.products (id, name, category, description, is_active, sort_order) values
  ('11111111-1111-4111-8111-111111111111','Photographic Print','Prints','Archival lustre photographic paper, interleaved in tissue. Printed to order.',true,1);

insert into public.product_variants (product_id, size_label, width_in, height_in, price_cents, sort_order) values
  ('11111111-1111-4111-8111-111111111111','4x6',4,6,900,1),
  ('11111111-1111-4111-8111-111111111111','5x7',5,7,1400,2),
  ('11111111-1111-4111-8111-111111111111','8x10',8,10,1800,3),
  ('11111111-1111-4111-8111-111111111111','8x12',8,12,2200,4),
  ('11111111-1111-4111-8111-111111111111','10x10',10,10,2400,5),
  ('11111111-1111-4111-8111-111111111111','10x20',10,20,5200,6),
  ('11111111-1111-4111-8111-111111111111','11x14',11,14,2800,7),
  ('11111111-1111-4111-8111-111111111111','12x18',12,18,4000,8),
  ('11111111-1111-4111-8111-111111111111','16x20',16,20,4600,9),
  ('11111111-1111-4111-8111-111111111111','16x24',16,24,5600,10),
  ('11111111-1111-4111-8111-111111111111','20x24',20,24,6800,11),
  ('11111111-1111-4111-8111-111111111111','20x30',20,30,7800,12);

-- SEED: event + photos
insert into public.events (id, slug, title, event_date, location, description, is_published, downloads_enabled, sort_order) values
  ('22222222-2222-4222-8222-222222222222','runway72026','Runway 7, 2026','2026-03-14','Paris','Archival frames from the front row. Select any photograph to view at full size and order prints.',true,true,1);

insert into public.photos (event_id, photo_number, preview_url, width, height, sort_order) values
  ('22222222-2222-4222-8222-222222222222','N07_021','/photos/n07_021.jpg',1200,1600,1),
  ('22222222-2222-4222-8222-222222222222','N07_034','/photos/n07_034.jpg',900,1200,2),
  ('22222222-2222-4222-8222-222222222222','N07_046','/photos/n07_046.jpg',900,1200,3),
  ('22222222-2222-4222-8222-222222222222','N07_088','/photos/n07_088.jpg',1600,1000,4),
  ('22222222-2222-4222-8222-222222222222','N07_102','/photos/n07_102.jpg',900,700,5),
  ('22222222-2222-4222-8222-222222222222','N07_118','/photos/n07_118.jpg',900,1200,6),
  ('22222222-2222-4222-8222-222222222222','N07_134','/photos/n07_134.jpg',1200,1600,7),
  ('22222222-2222-4222-8222-222222222222','N07_150','/photos/n07_150.jpg',1600,1000,8);

update public.events set cover_photo_id = (select id from public.photos where photo_number = 'N07_021') where slug = 'runway72026';
