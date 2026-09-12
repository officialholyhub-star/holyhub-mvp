import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

export async function marketplaceDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated,service_role;grant all on storage.objects to anon,authenticated,service_role;grant select on storage.buckets to anon,authenticated,service_role;`);
  for (const file of ['001_stage1_foundation.sql','002_business_discovery.sql','003_marketplace.sql','004_marketplace_storage.sql','005_payment_boundary.sql','006_order_delivery.sql','007_launch_readiness.sql','008_events_directory.sql']) await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8'));
  const as = (user, fn) => db.transaction(async tx => {
    await tx.exec(`set local role ${user === 'service' ? 'service_role' : user ? 'authenticated' : 'anon'}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user === 'service' ? '' : user ?? '']);
    return fn(tx);
  });
  return { db, as };
}
