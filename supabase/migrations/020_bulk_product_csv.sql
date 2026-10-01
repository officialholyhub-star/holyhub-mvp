-- Per-lister SKU uniqueness and atomic, retry-safe draft imports.
alter table public.products add column sku text
  check (sku is null or (sku = btrim(sku) and char_length(sku) between 1 and 100 and sku !~ '[[:cntrl:]]'));
create unique index products_lister_sku_unique
  on public.products (lister_user_id, lower(sku)) where sku is not null;
grant insert (id, sku) on public.products to authenticated;
grant update (sku) on public.products to authenticated;

create function public.import_product_csv_row(p_id uuid, p_product jsonb, p_sizes text[], p_stock_quantities integer[])
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_id uuid;
begin
  if auth.uid() is null or not (select private.has_role('lister')) then
    raise exception 'Lister access is required.';
  end if;
  -- The authenticated caller owns the listing. Publication and images are never
  -- accepted from the payload. Existing review triggers assign draft status.
  insert into public.products (id, lister_user_id, name, description, category_type, price, currency, stock_quantity, sku, image_url, is_published)
  values (p_id, auth.uid(), p_product->>'name', p_product->>'description', p_product->>'category_type',
    (p_product->>'price')::numeric, 'GBP', (p_product->>'stock_quantity')::integer,
    nullif(upper(btrim(p_product->>'sku')), ''), null, false)
  on conflict (id) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    if not exists (select 1 from public.products where id = p_id and lister_user_id = auth.uid()) then
      raise exception 'Import could not be completed.';
    end if;
    return 'already imported';
  end if;

  -- Uses the existing relational inventory function in this same transaction.
  -- A variant failure rolls back this row's product, leaving other rows intact.
  perform public.save_product_variants(inserted_id, p_sizes, p_stock_quantities);
  return 'imported';
end;
$$;
revoke all on function public.import_product_csv_row(uuid, jsonb, text[], integer[]) from public, anon;
grant execute on function public.import_product_csv_row(uuid, jsonb, text[], integer[]) to authenticated;
