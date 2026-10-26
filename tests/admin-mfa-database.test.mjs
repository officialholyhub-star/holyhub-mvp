// Real Postgres, local disposable container only. No connection strings or remote access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const container = process.env.HOLYHUB_MFA_TEST_CONTAINER;
if (container) assert.equal(container, 'holyhub-c2-mfa-postgres');
const migration = readFileSync('supabase/migrations/20261026230750_c2_admin_aal2.sql', 'utf8');
test('RLS admin role requires AAL2 with TOTP; own role/customer/lister access remains AAL1', { skip: !container }, () => {
  const sql = `begin;
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on all functions in schema auth to authenticated;
    ${readFileSync('supabase/migrations/001_stage1_foundation.sql', 'utf8')}
    ${readFileSync('supabase/migrations/002_lister_applications.sql', 'utf8')}
    ${migration}
    insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
    insert into public.user_roles(user_id,role) values ('11111111-1111-4111-8111-111111111111','admin'), ('11111111-1111-4111-8111-111111111111','lister');
    insert into public.lister_applications(user_id,business_name,contact_name,email,website_or_social,description,category_type) values ('22222222-2222-4222-8222-222222222222','Fixture shop','Person','test@example.test','https://example.test','Fixture','Books');
    set local role authenticated;
    select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","aal":"aal1","amr":[{"method":"password"}]}',true);
    do $$ begin
      if private.has_role('admin') then raise exception 'AAL1 admin bypass'; end if;
      if not private.has_role('customer') or not private.has_role('lister') then raise exception 'AAL1 non-admin role denied'; end if;
      if (select count(*) from public.profiles) <> 1 then raise exception 'AAL1 admin sees other profiles'; end if;
      if (select count(*) from public.user_roles where role='admin') <> 1 then raise exception 'Own admin role unavailable for bootstrap'; end if;
      if (select count(*) from public.lister_applications) <> 0 then raise exception 'AAL1 sees admin applications'; end if;
    end $$;
    update public.lister_applications set status='approved';
    select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","aal":"aal2","amr":[{"method":"mfa/phone"}]}',true);
    do $$ begin if private.has_role('admin') then raise exception 'Non-TOTP bypass'; end if; end $$;
    select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","aal":"aal2","amr":[{"method":"totp"}]}',true);
    do $$ begin
      if not private.has_role('admin') then raise exception 'AAL2 admin denied'; end if;
      if (select count(*) from public.profiles) <> 2 then raise exception 'AAL2 profile access denied'; end if;
      if not exists(select 1 from public.lister_applications where status='pending') then raise exception 'AAL1 mutation succeeded'; end if;
    end $$;
    update public.lister_applications set status='approved';
    do $$ begin if not exists(select 1 from public.lister_applications where status='approved') then raise exception 'AAL2 mutation denied'; end if; end $$;
    select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","aal":"aal1"}',true);
    do $$ begin
      if private.has_role('admin') then raise exception 'Customer bypass'; end if;
      if not private.has_role('customer') then raise exception 'Customer denied'; end if;
      if (select count(*) from public.lister_applications) <> 1 then raise exception 'Own application denied'; end if;
    end $$;
    rollback;`;
  const result = spawnSync('docker', ['exec','-i',container,'psql','-U','postgres','-X','-v','ON_ERROR_STOP=1','-Atq'], { input: sql, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
