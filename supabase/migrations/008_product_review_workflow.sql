-- HOLYHUB: admin review for marketplace product listings.

create type public.product_review_status as enum ('draft', 'pending', 'approved', 'rejected');

alter table public.products
  add column review_status public.product_review_status not null default 'approved',
  add column review_reason text check (review_reason is null or char_length(review_reason) between 1 and 1000),
  add column reviewed_at timestamptz;

create policy "products_select_admin"
on public.products
for select
to authenticated
using ((select private.has_role('admin')));

create policy "products_update_admin_review"
on public.products
for update
to authenticated
using ((select private.has_role('admin')))
with check ((select private.has_role('admin')));

drop policy "products_select_published_anon" on public.products;
create policy "products_select_published_anon"
on public.products
for select
to anon
using (is_published = true and review_status = 'approved');

drop policy "products_select_authenticated" on public.products;
create policy "products_select_authenticated"
on public.products
for select
to authenticated
using (
  (is_published = true and review_status = 'approved')
  or (lister_user_id = (select auth.uid()) and (select private.has_role('lister')))
  or (select private.has_role('admin'))
);

grant update (review_status, review_reason, reviewed_at, updated_at) on public.products to authenticated;