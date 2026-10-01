-- Give the server-only service role the minimum product privileges needed by
-- the dedicated moderation action. Authenticated lister grants and RLS stay unchanged.
grant select on public.products to service_role;
grant update (review_status, review_reason, reviewed_at, updated_at, is_published)
on public.products to service_role;

-- Preserve each seller's one-time delivery charge for reliable order snapshots.
create table public.checkout_session_sellers (
  checkout_session_id uuid not null references public.checkout_sessions(id) on delete cascade,
  lister_user_id uuid not null references public.profiles(id) on delete restrict,
  seller_business_name text not null check (char_length(seller_business_name) between 1 and 150),
  delivery_total integer not null check (delivery_total >= 0),
  created_at timestamptz not null default now(),
  primary key (checkout_session_id, lister_user_id)
);

alter table public.checkout_session_sellers enable row level security;
revoke all on table public.checkout_session_sellers from public, anon, authenticated;
grant select, insert on public.checkout_session_sellers to service_role;
