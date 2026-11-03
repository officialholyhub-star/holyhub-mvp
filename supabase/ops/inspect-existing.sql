-- Read-only: run in the EXISTING project's SQL Editor before choosing a migration path.
-- Exposes schema/permissions only, not customer records.
select table_name, column_name, data_type, is_nullable
from information_schema.columns where table_schema = 'public'
order by table_name, ordinal_position;
select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by c.relname;
select schemaname, tablename, policyname, roles, cmd
from pg_policies where schemaname in ('public','storage') order by tablename, policyname;
select routine_name, security_type from information_schema.routines
where routine_schema='public' order by routine_name;
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
