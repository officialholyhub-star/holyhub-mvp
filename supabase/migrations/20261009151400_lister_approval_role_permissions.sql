-- Admin-only server action grants lister access after reviewing the application.
-- service_role bypasses RLS but still requires explicit table privileges.
-- Duplicate grants use ON CONFLICT DO NOTHING; no UPDATE/DELETE access is needed.
grant select (user_id, role) on public.user_roles to service_role;
grant insert (user_id, role) on public.user_roles to service_role;
