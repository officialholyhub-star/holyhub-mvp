-- HOLYHUB STAGE 4: checkout and payment tracking.

create type public.checkout_status as enum ('pending', 'paid', 'cancelled', 'failed');

create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  status public.checkout_status not null default 'pending',
  currency text not null default 'GBP' check (currency = 'GBP'),
  amount_total integer not null check (amount_total >= 0),
  payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.checkout_session_items (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid not null references public.checkout_sessions(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  lister_user_id uuid not null references public.profiles(id) on delete restrict,
  product_name text not null check (char_length(product_name) between 1 and 150),
  unit_amount integer not null check (unit_amount >= 0),
  quantity integer not null check (quantity between 1 and 20),
  line_total integer not null check (line_total = unit_amount * quantity),
  currency text not null default 'GBP' check (currency = 'GBP'),
  created_at timestamptz not null default now()
);

create index checkout_sessions_user_created_idx
on public.checkout_sessions (user_id, created_at desc);

create index checkout_session_items_session_idx
on public.checkout_session_items (checkout_session_id);

create index checkout_session_items_product_idx
on public.checkout_session_items (product_id);

create index checkout_session_items_lister_idx
on public.checkout_session_items (lister_user_id);

alter table public.checkout_sessions enable row level security;
alter table public.checkout_session_items enable row level security;

create policy "checkout_sessions_select_own"
on public.checkout_sessions
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "checkout_session_items_select_own"
on public.checkout_session_items
for select
to authenticated
using (exists (
  select 1
  from public.checkout_sessions
  where id = checkout_session_id and user_id = (select auth.uid())
));

revoke all on table public.checkout_sessions, public.checkout_session_items from public;
revoke all on table public.checkout_sessions, public.checkout_session_items from anon, authenticated;

grant select on public.checkout_sessions, public.checkout_session_items to authenticated;
grant select, insert, update on public.checkout_sessions to service_role;
grant select, insert on public.checkout_session_items to service_role;
