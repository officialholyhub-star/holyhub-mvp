-- Operational repair for the existing server-side application edit path.
-- No schema, RLS, or applicant-role changes. Run as the database owner.
-- Keep ownership, record identity and creation time outside UPDATE privileges.
grant select on public.lister_applications to service_role;
grant update (
  business_name, contact_name, email, website_or_social, description,
  category_type, status, rejection_reason, reviewed_at, updated_at
) on public.lister_applications to service_role;
