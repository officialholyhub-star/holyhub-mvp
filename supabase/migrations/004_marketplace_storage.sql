begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('product-images','product-images',false,5242880,array['image/webp']),('refund-evidence','refund-evidence',false,5242880,array['image/webp']);
create policy holyhub_product_photo_public on storage.objects for select to anon,authenticated using(bucket_id='product-images' and exists(select 1 from public.product_images i join public.products p on p.id=i.product_id where i.path=objects.name and p.status='published' and p.moderation_status='visible' and public.public_business(p.business_id)));
create policy holyhub_photo_owner_read on storage.objects for select to authenticated using(bucket_id in ('product-images','refund-evidence') and split_part(name,'/',1)=auth.uid()::text and public.is_active_account(auth.uid()));
create policy holyhub_product_photo_upload on storage.objects for insert to authenticated with check(bucket_id='product-images' and split_part(name,'/',1)=auth.uid()::text and exists(select 1 from public.products p where p.id::text=split_part(objects.name,'/',2) and public.manages_business(p.business_id)));
create policy holyhub_evidence_upload on storage.objects for insert to authenticated with check(bucket_id='refund-evidence' and split_part(name,'/',1)=auth.uid()::text and exists(select 1 from public.refund_cases r where r.id::text=split_part(name,'/',2) and public.can_access_refund(r.id) and r.status<>'closed'));
create policy holyhub_evidence_read on storage.objects for select to authenticated using(bucket_id='refund-evidence' and exists(select 1 from public.refund_evidence e where e.path=name and public.can_access_refund(e.refund_id)));
create policy holyhub_product_admin_read on storage.objects for select to authenticated using(bucket_id='product-images' and public.has_role('admin'));
create policy holyhub_upload_cleanup on storage.objects for delete to authenticated using(bucket_id in ('product-images','refund-evidence') and split_part(name,'/',1)=auth.uid()::text and public.is_active_account(auth.uid()) and not exists(select 1 from public.product_images i where i.path=name) and not exists(select 1 from public.refund_evidence e where e.path=name));

create function public.register_image(image_kind text,target_id uuid,object_path text) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; bucket text; begin
 if not is_active_account(auth.uid()) or split_part(object_path,'/',1)<>auth.uid()::text or split_part(object_path,'/',2)<>target_id::text or object_path !~ '^[a-f0-9-]+/[a-f0-9-]+/[a-f0-9-]+\.webp$' then raise exception 'Invalid upload'; end if;
 bucket:=case when image_kind='product' then 'product-images' when image_kind='evidence' then 'refund-evidence' end;
 if bucket is null or not exists(select 1 from storage.objects where bucket_id=bucket and name=object_path) then raise exception 'Upload not found'; end if;
 if image_kind='product' then
  perform 1 from products where id=target_id and manages_business(business_id) for update;
  if not found then raise exception 'Product unavailable'; end if;
  if (select count(*) from product_images where product_id=target_id)>=5 then raise exception 'Use up to five product images'; end if;
  insert into product_images(product_id,path) values(target_id,object_path) returning id into result;
 else
  perform 1 from refund_cases where id=target_id and can_access_refund(id) and status<>'closed' for update;
  if not found then raise exception 'Refund case unavailable'; end if;
  if (select count(*) from refund_evidence where refund_id=target_id and author_id=auth.uid())>=5 then raise exception 'Use up to five evidence images per person'; end if;
  insert into refund_evidence(refund_id,author_id,path) values(target_id,auth.uid(),object_path) returning id into result;
 end if;
 insert into audit_log(actor_id,action,entity_id) values(auth.uid(),'image.'||image_kind,target_id);
 return result;
end $$;
revoke all on function public.register_image(text,uuid,text) from public,anon;
grant execute on function public.register_image(text,uuid,text) to authenticated;

create function public.add_basket_item(product_id uuid,quantity int) returns void language plpgsql security definer set search_path=public as $$
declare existing int;begin
 if quantity is null or quantity not between 1 and 99 then raise exception 'Invalid quantity';end if;
 perform 1 from profiles where id=auth.uid() and is_active_account(auth.uid()) for update;
 select b.quantity into existing from basket_items b where b.product_id=add_basket_item.product_id and user_id=auth.uid();
 perform set_basket_item(product_id,coalesce(existing,0)+quantity);
end $$;
revoke all on function public.add_basket_item(uuid,int) from public,anon;
grant execute on function public.add_basket_item(uuid,int) to authenticated;
commit;
