-- Add storefront branding and separate optional brand links without dropping legacy data.
alter table public.lister_storefronts
  add column logo_url text check (logo_url is null or char_length(logo_url) between 1 and 500),
  add column website_url text check (website_url is null or (char_length(website_url) between 1 and 500 and website_url ~* '^https?://')),
  add column instagram_url text check (instagram_url is null or (char_length(instagram_url) between 1 and 500 and instagram_url ~* '^https?://'));

-- Keep the original website_or_social column unchanged while classifying known social hosts.
update public.lister_storefronts
set instagram_url = website_or_social
where website_or_social is not null
  and website_or_social ~* '^https?://'
  and lower(website_or_social) ~ '^https?://([^/?#]*[.])?(instagram[.]com|facebook[.]com|tiktok[.]com|youtube[.]com|youtu[.]be|x[.]com|twitter[.]com|pinterest[.]com)([/?#]|$)';

update public.lister_storefronts
set website_url = website_or_social
where website_or_social is not null
  and website_or_social ~* '^https?://'
  and instagram_url is null;

grant insert (user_id, business_name, description, category_type, website_url, instagram_url, logo_url, delivery_option, delivery_charge, delivery_country, updated_at)
on public.lister_storefronts to authenticated;
grant update (business_name, description, category_type, website_url, instagram_url, logo_url, delivery_option, delivery_charge, delivery_country, updated_at)
on public.lister_storefronts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lister-logos',
  'lister-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lister_logos_insert_own_lister" on storage.objects;
create policy "lister_logos_insert_own_lister"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lister-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.has_role('lister'))
);

drop policy if exists "lister_logos_delete_own_lister" on storage.objects;
create policy "lister_logos_delete_own_lister"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lister-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.has_role('lister'))
);