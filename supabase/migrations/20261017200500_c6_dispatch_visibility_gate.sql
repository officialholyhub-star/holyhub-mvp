-- C6 follow-up: a seller without a complete dispatch promise must not have
-- customer-visible products. Listers/admins can still review their own records.

create or replace function public.seller_dispatch_is_ready(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lister_storefronts s
    where s.user_id = p_user_id
      and (
        s.dispatch_window in ('1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days')
        or (
          s.dispatch_window = 'made-to-order'
          and nullif(btrim(s.dispatch_custom_timeframe), '') is not null
          and char_length(btrim(s.dispatch_custom_timeframe)) <= 120
        )
      )
  );
$$;

revoke all on function public.seller_dispatch_is_ready(uuid) from public;
grant execute on function public.seller_dispatch_is_ready(uuid) to anon, authenticated;

drop policy if exists "products_select_published_anon" on public.products;
create policy "products_select_published_anon"
on public.products
for select
to anon
using (
  is_published = true
  and review_status = 'approved'
  and (select public.seller_identity_is_verified(lister_user_id))
  and (select public.seller_dispatch_is_ready(lister_user_id))
);

drop policy if exists "products_select_authenticated" on public.products;
create policy "products_select_authenticated"
on public.products
for select
to authenticated
using (
  (
    is_published = true
    and review_status = 'approved'
    and (select public.seller_identity_is_verified(lister_user_id))
    and (select public.seller_dispatch_is_ready(lister_user_id))
  )
  or (lister_user_id = (select auth.uid()) and (select private.has_role('lister')))
  or (select private.has_role('admin'))
);
