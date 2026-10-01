create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null check (size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size)
);

create index product_variants_product_idx on public.product_variants(product_id);

alter table public.products
  add column if not exists size_guide_url text check (size_guide_url is null or char_length(size_guide_url) between 1 and 500);

alter table public.checkout_session_items
  add column variant_id uuid references public.product_variants(id) on delete set null,
  add column variant_size text,
  add column variant_reserved boolean not null default false,
  add column stock_decremented boolean not null default false;

alter table public.order_items
  add column variant_id uuid references public.product_variants(id) on delete set null,
  add column variant_size text;

alter table public.product_variants enable row level security;
revoke all on table public.product_variants from public;
revoke all on table public.product_variants from anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;
grant all on public.product_variants to service_role;

grant select, insert, update on public.checkout_session_items to service_role;
grant select, insert on public.order_items to service_role;
grant insert (size_guide_url) on public.products to authenticated;
grant update (size_guide_url) on public.products to authenticated;

create policy "product_variants_select_public_or_owner"
on public.product_variants
for select
to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_id
      and p.is_published = true
      and p.review_status = 'approved'
  )
  or (
    (select auth.role()) = 'authenticated'
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.lister_user_id = (select auth.uid())
        and (select private.has_role('lister'))
    )
  )
  or (
    (select auth.role()) = 'authenticated'
    and (select private.has_role('admin'))
  )
);

create policy "product_variants_insert_own_lister"
on public.product_variants
for insert
to authenticated
with check (
  exists (
    select 1 from public.products p
    where p.id = product_id
      and p.lister_user_id = (select auth.uid())
      and (select private.has_role('lister'))
  )
);

create policy "product_variants_update_own_lister"
on public.product_variants
for update
to authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_id
      and p.lister_user_id = (select auth.uid())
      and (select private.has_role('lister'))
  )
)
with check (
  exists (
    select 1 from public.products p
    where p.id = product_id
      and p.lister_user_id = (select auth.uid())
      and (select private.has_role('lister'))
  )
);

create policy "product_variants_delete_own_lister"
on public.product_variants
for delete
to authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_id
      and p.lister_user_id = (select auth.uid())
      and (select private.has_role('lister'))
  )
);

create or replace function public.save_product_variants(
  p_product_id uuid,
  p_sizes text[],
  p_stock_quantities integer[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_category text;
  submitted_sizes text[];
  expected_sizes constant text[] := array['XS', 'S', 'M', 'L', 'XL', 'XXL'];
begin
  if not (select private.has_role('lister')) then
    raise exception 'Lister access is required.';
  end if;

  select p.category_type into saved_category
  from public.products p
  where p.id = p_product_id and p.lister_user_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Product not found.';
  end if;

  if p_sizes is null or p_stock_quantities is null
    or cardinality(p_sizes) <> cardinality(p_stock_quantities)
    or exists (select 1 from unnest(p_stock_quantities) quantity where quantity is null or quantity < 0) then
    raise exception 'Invalid product size inventory.';
  end if;

  if saved_category = 'Apparel' then
    select array_agg(size order by size) into submitted_sizes from unnest(p_sizes) size;
    if cardinality(p_sizes) <> cardinality(expected_sizes)
      or submitted_sizes is distinct from (select array_agg(size order by size) from unnest(expected_sizes) size) then
      raise exception 'All apparel sizes must be provided exactly once.';
    end if;
  elsif cardinality(p_sizes) <> 0 then
    raise exception 'Size inventory is only available for apparel.';
  end if;

  if exists (
    select 1
    from public.checkout_session_items item
    join public.product_variants variant on variant.id = item.variant_id
    where variant.product_id = p_product_id and item.variant_reserved
      and not (variant.size = any(p_sizes))
  ) then
    raise exception 'A size with an active checkout cannot be removed.';
  end if;

  insert into public.product_variants(product_id, size, stock_quantity)
  select p_product_id, submitted.size, submitted.stock_quantity
  from unnest(p_sizes, p_stock_quantities) as submitted(size, stock_quantity)
  on conflict (product_id, size) do update
    set stock_quantity = excluded.stock_quantity,
        updated_at = now();

  delete from public.product_variants variant
  where variant.product_id = p_product_id
    and not (variant.size = any(p_sizes));

  update public.products p
  set stock_quantity = case when saved_category = 'Apparel' then coalesce((
    select sum(variant.stock_quantity)::integer
    from public.product_variants variant
    where variant.product_id = p_product_id
  ), 0) else p.stock_quantity end
  where p.id = p_product_id;
end;
$$;

revoke all on function public.save_product_variants(uuid, text[], integer[]) from public, anon;
grant execute on function public.save_product_variants(uuid, text[], integer[]) to authenticated;

create or replace function public.process_paid_checkout_stock(p_checkout_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row record;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service access is required.';
  end if;

  for item_row in
    select item.id, item.product_id, item.variant_id, item.quantity, item.stock_decremented
    from public.checkout_session_items item
    join public.checkout_sessions checkout on checkout.id = item.checkout_session_id
    where item.checkout_session_id = p_checkout_session_id and checkout.status = 'paid'
    for update of item
  loop
    if item_row.stock_decremented then
      continue;
    end if;

    if item_row.variant_id is not null then
      update public.product_variants variant
      set stock_quantity = variant.stock_quantity - item_row.quantity,
          updated_at = now()
      where variant.id = item_row.variant_id
        and variant.stock_quantity >= item_row.quantity;
      if not found then
        raise exception 'Insufficient variant stock.';
      end if;
      update public.checkout_session_items
      set variant_reserved = true, stock_decremented = true
      where id = item_row.id;
      update public.products product
      set stock_quantity = coalesce((
        select sum(variant.stock_quantity)::integer
        from public.product_variants variant
        where variant.product_id = item_row.product_id
      ), 0)
      where product.id = item_row.product_id;
    else
      update public.products product
      set stock_quantity = product.stock_quantity - item_row.quantity
      where product.id = item_row.product_id
        and product.stock_quantity >= item_row.quantity;
      if not found then
        raise exception 'Insufficient product stock.';
      end if;
      update public.checkout_session_items
      set stock_decremented = true
      where id = item_row.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.process_paid_checkout_stock(uuid) from public, anon, authenticated;
grant execute on function public.process_paid_checkout_stock(uuid) to service_role;

create or replace function public.reserve_checkout_variant(p_checkout_session_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row record;
  reserved_product_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service access is required.';
  end if;

  select item.id, item.variant_id, item.quantity, item.variant_reserved, session.status
  into item_row
  from public.checkout_session_items item
  join public.checkout_sessions session on session.id = item.checkout_session_id
  where item.id = p_checkout_session_item_id
  for update of item;
  if not found or item_row.status <> 'pending' or item_row.variant_id is null then
    return false;
  end if;
  if item_row.variant_reserved then
    return true;
  end if;

  update public.product_variants variant
  set stock_quantity = variant.stock_quantity - item_row.quantity,
      updated_at = now()
  where variant.id = item_row.variant_id
    and variant.stock_quantity >= item_row.quantity
  returning variant.product_id into reserved_product_id;
  if not found then
    return false;
  end if;

  update public.checkout_session_items
  set variant_reserved = true
  where id = item_row.id;

  update public.products product
  set stock_quantity = coalesce((
    select sum(variant.stock_quantity)::integer
    from public.product_variants variant
    where variant.product_id = reserved_product_id
  ), 0)
  where product.id = reserved_product_id;

  return true;
end;
$$;

create or replace function public.release_checkout_variant_reservations(p_checkout_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation record;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service access is required.';
  end if;

  for reservation in
    select item.id, item.variant_id, item.quantity
    from public.checkout_session_items item
    where item.checkout_session_id = p_checkout_session_id and item.variant_reserved
    for update
  loop
    update public.product_variants variant
    set stock_quantity = variant.stock_quantity + reservation.quantity,
        updated_at = now()
    where variant.id = reservation.variant_id;
    update public.checkout_session_items set variant_reserved = false where id = reservation.id;
    update public.products product
    set stock_quantity = coalesce((
      select sum(variant.stock_quantity)::integer
      from public.product_variants variant
      where variant.product_id = product.id
    ), 0)
    where product.id = (select variant.product_id from public.product_variants variant where variant.id = reservation.variant_id);
  end loop;
end;
$$;

create or replace function public.commit_checkout_variant_reservations(p_checkout_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service access is required.';
  end if;
  update public.checkout_session_items
  set variant_reserved = false
  where checkout_session_id = p_checkout_session_id and variant_reserved;
end;
$$;

revoke all on function public.reserve_checkout_variant(uuid) from public, anon, authenticated;
revoke all on function public.release_checkout_variant_reservations(uuid) from public, anon, authenticated;
revoke all on function public.commit_checkout_variant_reservations(uuid) from public, anon, authenticated;
grant execute on function public.reserve_checkout_variant(uuid) to service_role;
grant execute on function public.release_checkout_variant_reservations(uuid) to service_role;
grant execute on function public.commit_checkout_variant_reservations(uuid) to service_role;

grant insert (variant_id, variant_size) on public.order_items to service_role;
