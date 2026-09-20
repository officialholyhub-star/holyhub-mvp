-- HOLYHUB STAGE 5: shipping, stock and order foundation.

create type public.order_status as enum ('pending_payment', 'paid', 'cancelled', 'failed');
create type public.fulfilment_status as enum ('pending', 'packed', 'dispatched', 'delivered', 'cancelled');

alter table public.lister_storefronts
  add column if not exists delivery_option text not null default 'free' check (delivery_option in ('free', 'flat')),
  add column if not exists delivery_charge numeric(10, 2) not null default 0 check (delivery_charge >= 0),
  add column if not exists delivery_country text not null default 'GB' check (delivery_country = 'GB');

alter table public.products
  add column if not exists stock_quantity integer not null default 0 check (stock_quantity >= 0);

alter table public.checkout_sessions
  add column if not exists product_subtotal integer not null default 0 check (product_subtotal >= 0),
  add column if not exists delivery_total integer not null default 0 check (delivery_total >= 0),
  add column if not exists holyhub_commission integer not null default 0 check (holyhub_commission >= 0),
  add column if not exists seller_amount_total integer not null default 0 check (seller_amount_total >= 0);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkout_session_id uuid references public.checkout_sessions(id) on delete set null,
  stripe_checkout_session_id text not null unique,
  order_status public.order_status not null default 'pending_payment',
  fulfilment_status public.fulfilment_status not null default 'pending',
  currency text not null default 'GBP' check (currency = 'GBP'),
  product_subtotal integer not null check (product_subtotal >= 0),
  delivery_total integer not null check (delivery_total >= 0),
  total_amount integer not null check (total_amount >= 0),
  holyhub_commission integer not null check (holyhub_commission >= 0),
  seller_amount_total integer not null check (seller_amount_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  seller_user_id uuid not null references public.profiles(id) on delete restrict,
  product_name text not null check (char_length(product_name) between 1 and 150),
  unit_amount integer not null check (unit_amount >= 0),
  quantity integer not null check (quantity between 1 and 20),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.seller_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  seller_user_id uuid not null references public.profiles(id) on delete restrict,
  seller_business_name text not null check (char_length(seller_business_name) between 1 and 150),
  product_subtotal integer not null check (product_subtotal >= 0),
  delivery_total integer not null check (delivery_total >= 0),
  total_amount integer not null check (total_amount >= 0),
  holyhub_commission integer not null check (holyhub_commission >= 0),
  seller_amount integer not null check (seller_amount >= 0),
  order_status public.order_status not null default 'paid',
  fulfilment_status public.fulfilment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz
);

create index orders_user_created_idx
on public.orders (user_id, created_at desc);

create index orders_session_idx
on public.orders (checkout_session_id);

create index order_items_order_idx
on public.order_items (order_id);

create index order_items_seller_idx
on public.order_items (seller_user_id);

create index seller_orders_order_idx
on public.seller_orders (order_id);

create index seller_orders_seller_idx
on public.seller_orders (seller_user_id, created_at desc);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.seller_orders enable row level security;

create policy "orders_select_own_or_seller_or_admin"
on public.orders
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.seller_orders so
    where so.order_id = orders.id and so.seller_user_id = (select auth.uid())
  )
  or (select private.has_role('admin'))
);

create policy "order_items_select_own_or_seller_or_admin"
on public.order_items
for select
to authenticated
using (
  seller_user_id = (select auth.uid())
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id and o.user_id = (select auth.uid())
  )
  or (select private.has_role('admin'))
);

create policy "seller_orders_select_own_or_admin"
on public.seller_orders
for select
to authenticated
using (
  seller_user_id = (select auth.uid())
  or exists (
    select 1
    from public.orders o
    where o.id = seller_orders.order_id and o.user_id = (select auth.uid())
  )
  or (select private.has_role('admin'))
);

revoke all on table public.orders, public.order_items, public.seller_orders from public;
revoke all on table public.orders, public.order_items, public.seller_orders from anon, authenticated;

grant select on public.orders, public.order_items, public.seller_orders to authenticated;
grant insert (user_id, checkout_session_id, stripe_checkout_session_id, order_status, fulfilment_status, currency, product_subtotal, delivery_total, total_amount, holyhub_commission, seller_amount_total, paid_at, cancelled_at) on public.orders to service_role;
grant update (order_status, fulfilment_status, updated_at, paid_at, cancelled_at) on public.orders to service_role;
grant insert (order_id, product_id, seller_user_id, product_name, unit_amount, quantity, line_total) on public.order_items to service_role;
grant insert (order_id, seller_user_id, seller_business_name, product_subtotal, delivery_total, total_amount, holyhub_commission, seller_amount, order_status, fulfilment_status, paid_at, dispatched_at, delivered_at) on public.seller_orders to service_role;
grant update (seller_business_name, product_subtotal, delivery_total, total_amount, holyhub_commission, seller_amount, order_status, fulfilment_status, updated_at, paid_at, dispatched_at, delivered_at) on public.seller_orders to service_role;

grant insert (user_id, business_name, description, category_type, website_or_social, delivery_option, delivery_charge, delivery_country, updated_at) on public.lister_storefronts to authenticated;
grant update (business_name, description, category_type, website_or_social, delivery_option, delivery_charge, delivery_country, updated_at) on public.lister_storefronts to authenticated;
grant insert (lister_user_id, name, description, category_type, price, currency, image_url, stock_quantity, is_published) on public.products to authenticated;
grant update (name, description, category_type, price, currency, image_url, stock_quantity, is_published, updated_at) on public.products to authenticated;
