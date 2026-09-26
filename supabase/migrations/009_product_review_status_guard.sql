-- Keep lister product writes within the review workflow without granting
-- listers permission to set review metadata directly.
create or replace function private.set_lister_product_review_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.has_role('admin')) then
    new.review_status := case
      when new.is_published then 'pending'::public.product_review_status
      else 'draft'::public.product_review_status
    end;
    new.review_reason := null;
    new.reviewed_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.set_lister_product_review_status() from public, anon, authenticated;

drop trigger if exists products_set_lister_review_status on public.products;
create trigger products_set_lister_review_status
before insert or update on public.products
for each row execute function private.set_lister_product_review_status();