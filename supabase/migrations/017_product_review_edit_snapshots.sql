-- Preserve the last approved presentation values while a material edit is pending review.
create table public.product_review_snapshots (
  product_id uuid primary key references public.products(id) on delete cascade,
  previous_name text not null,
  previous_description text not null,
  previous_category_type text not null,
  previous_image_url text,
  previous_size_guide_url text,
  captured_at timestamptz not null default now()
);

alter table public.product_review_snapshots enable row level security;
revoke all on table public.product_review_snapshots from public, anon, authenticated;
grant select on public.product_review_snapshots to authenticated;
-- Server-only approval cleanup filters by product_id before deleting snapshots.
grant select (product_id) on public.product_review_snapshots to service_role;
grant delete on public.product_review_snapshots to service_role;

create policy "product_review_snapshots_select_admin"
on public.product_review_snapshots
for select
to authenticated
using ((select private.has_role('admin')));

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
    material_change := new.name is distinct from old.name
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
        previous_size_guide_url
      ) values (
        old.id,
        old.name,
        old.description,
        old.category_type,
        old.image_url,
        old.size_guide_url
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
