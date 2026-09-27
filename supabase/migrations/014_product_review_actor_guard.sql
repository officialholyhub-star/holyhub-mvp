-- Route authenticated product writes through review, even for admin+lister accounts.
-- Only service-role moderation writes may move pending listings to approved/rejected.
create or replace function private.set_lister_product_review_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_role text := auth.role();
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
