-- Add an image-aware overload; keep the four-argument import compatible.
-- The nested RPC and gallery helper share this transaction. A gallery failure
-- rolls back the product, SKU and variants created by migration 020.
create function public.import_product_csv_row(
  p_id uuid, p_product jsonb, p_sizes text[], p_stock_quantities integer[], p_images text[]
)
returns text language plpgsql security invoker set search_path = '' as $$
declare import_result text;
begin
  import_result := public.import_product_csv_row(p_id, p_product, p_sizes, p_stock_quantities);
  if import_result = 'imported' then
    perform private.replace_product_gallery(p_id, p_images);
  end if;
  -- Never replace a completed import's gallery: the lister may have edited it.
  return import_result;
end;
$$;
revoke all on function public.import_product_csv_row(uuid, jsonb, text[], integer[], text[])
  from public, anon;
grant execute on function public.import_product_csv_row(uuid, jsonb, text[], integer[], text[])
  to authenticated;
