-- Ordered galleries, atomic saves, and gallery-aware material-edit snapshots.
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null check (char_length(image_url) between 1 and 500),
  sort_order integer not null check (sort_order between 0 and 4),
  created_at timestamptz not null default now(),
  unique (product_id, sort_order),
  unique (product_id, image_url)
);
alter table public.product_images enable row level security;
revoke all on public.product_images from public, anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant all on public.product_images to service_role;
create policy "product_images_read_visible_product" on public.product_images
for select to anon, authenticated using (
  exists (select 1 from public.products where id = product_id)
);

alter table public.products add column gallery_revision integer not null default 0;
alter table public.product_review_snapshots add column previous_gallery_images text[];

create or replace function private.set_lister_product_review_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_role text := auth.role();
  material_change boolean;
begin
  if tg_op = 'INSERT' then
    new.review_status := case
      when new.is_published then 'pending'::public.product_review_status
      else 'draft'::public.product_review_status
    end;
    new.review_reason := null;
    new.reviewed_at := null;
    return new;
  end if;

  if request_role = 'service_role' then
    if new.review_status is distinct from old.review_status then
      if old.review_status <> 'pending'::public.product_review_status
        or new.review_status not in (
          'approved'::public.product_review_status,
          'rejected'::public.product_review_status
        ) then
        raise exception 'Product review status can only be moderated from pending.';
      end if;
    elsif new.review_reason is distinct from old.review_reason
      or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'Product review metadata requires a moderation transition.';
    end if;
    return new;
  end if;

  if old.review_status = 'approved'::public.product_review_status then
    material_change := new.gallery_revision is distinct from old.gallery_revision
      or new.name is distinct from old.name
      or new.description is distinct from old.description
      or new.category_type is distinct from old.category_type
      or new.image_url is distinct from old.image_url
      or new.size_guide_url is distinct from old.size_guide_url;

    if new.is_published and material_change then
      insert into public.product_review_snapshots (
        product_id,
        previous_name,
        previous_description,
        previous_category_type,
        previous_image_url,
        previous_size_guide_url,
        previous_gallery_images
      ) values (
        old.id,
        old.name,
        old.description,
        old.category_type,
        old.image_url,
        old.size_guide_url,
        coalesce((select array_agg(image_url order by sort_order) from public.product_images where product_id = old.id),
          case when old.image_url is null then array[]::text[] else array[old.image_url] end)
      ) on conflict (product_id) do nothing;
      new.review_status := 'pending'::public.product_review_status;
      new.review_reason := null;
      new.reviewed_at := null;
    elsif new.is_published then
      new.review_status := 'approved'::public.product_review_status;
    else
      new.review_status := 'draft'::public.product_review_status;
      new.review_reason := null;
      new.reviewed_at := null;
    end if;
    return new;
  end if;

  new.review_status := case
    when new.is_published then 'pending'::public.product_review_status
    else 'draft'::public.product_review_status
  end;
  new.review_reason := null;
  new.reviewed_at := null;
  return new;
end;
$$;

revoke all on function private.set_lister_product_review_status() from public, anon, authenticated;

-- No direct gallery writes are granted to API roles. This private, narrowly
-- guarded helper owns the mutations and synchronises the legacy cover column.
create function private.replace_product_gallery(p_product_id uuid, p_images text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  product_row public.products;
  previous_images text[];
begin
  if auth.uid() is null or not (select private.has_role('lister')) then
    raise exception 'Lister access is required.';
  end if;
  select * into product_row from public.products
  where id = p_product_id and lister_user_id = auth.uid() for update;
  if not found then raise exception 'Product not found.'; end if;
  select coalesce(array_agg(image_url order by sort_order),
    case when product_row.image_url is null then array[]::text[] else array[product_row.image_url] end)
  into previous_images from public.product_images where product_id = p_product_id;
  if p_images is null or cardinality(p_images) > 5
    or cardinality(p_images) <> (select count(distinct url) from unnest(p_images) url)
    or exists (select 1 from unnest(p_images) url where url is null or char_length(url) not between 1 and 500
      or (not (url = any(previous_images)) and url !~ (
        '^https?://[^/]+/storage/v1/object/public/product-images/' || auth.uid()::text || '/[A-Za-z0-9_.-]+$')))
    or (product_row.is_published and cardinality(p_images) = 0) then
    raise exception 'Choose up to five owned images; submission requires an image.';
  end if;
  if previous_images is distinct from p_images then
    -- Capture the old gallery before replacing rows, including changes beyond
    -- the cover. The existing trigger retains the first approved snapshot.
    update public.products set image_url = p_images[1], gallery_revision = gallery_revision + 1,
      updated_at = now() where id = p_product_id;
  end if;
  delete from public.product_images where product_id = p_product_id;
  insert into public.product_images(product_id, image_url, sort_order)
  select p_product_id, url, ordinal - 1 from unnest(p_images) with ordinality as images(url, ordinal);
end;
$$;
revoke all on function private.replace_product_gallery(uuid, text[]) from public, anon;
grant execute on function private.replace_product_gallery(uuid, text[]) to authenticated;

create function public.save_product_with_images(p_product_id uuid, p_values jsonb,
  p_images text[], p_sizes text[], p_stock_quantities integer[])
returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid;
begin
  if auth.uid() is null or not (select private.has_role('lister')) then
    raise exception 'Lister access is required.';
  end if;
  if p_images is null or cardinality(p_images) > 5
    or ((p_values->>'is_published')::boolean and cardinality(p_images) = 0)
    or ((p_values->>'is_published')::boolean and p_values->>'category_type' = 'Apparel'
      and not exists (select 1 from unnest(p_stock_quantities) quantity where quantity > 0)) then
    raise exception 'Submission requires an image and available apparel size stock.';
  end if;
  if p_product_id is null then
    insert into public.products(lister_user_id, name, description, category_type, price, currency,
      stock_quantity, image_url, size_guide_url, is_published)
    values (auth.uid(), p_values->>'name', p_values->>'description', p_values->>'category_type',
      (p_values->>'price')::numeric, 'GBP', (p_values->>'stock_quantity')::integer,
      null, nullif(p_values->>'size_guide_url', ''), (p_values->>'is_published')::boolean)
    returning id into saved_id;
  else
    update public.products set name = p_values->>'name', description = p_values->>'description',
      category_type = p_values->>'category_type', price = (p_values->>'price')::numeric,
      stock_quantity = (p_values->>'stock_quantity')::integer,
      size_guide_url = nullif(p_values->>'size_guide_url', ''),
      is_published = (p_values->>'is_published')::boolean, updated_at = now()
    where id = p_product_id and lister_user_id = auth.uid() returning id into saved_id;
    if saved_id is null then raise exception 'Product not found.'; end if;
  end if;
  perform private.replace_product_gallery(saved_id, p_images);
  perform public.save_product_variants(saved_id, p_sizes, p_stock_quantities);
  return saved_id;
end;
$$;
revoke all on function public.save_product_with_images(uuid, jsonb, text[], text[], integer[]) from public, anon;
grant execute on function public.save_product_with_images(uuid, jsonb, text[], text[], integer[]) to authenticated;
