-- Keep privileged ownership/admin checks out of anonymous policy evaluation.
-- The authenticated predicate and all variant write policies remain unchanged.
alter policy "product_variants_select_public_or_owner"
on public.product_variants
to authenticated;

create policy "product_variants_select_published_anon"
on public.product_variants
for select
to anon
using (
  exists (
    select 1 from public.products p
    where p.id = product_id
      and p.is_published = true
      and p.review_status = 'approved'
  )
);
