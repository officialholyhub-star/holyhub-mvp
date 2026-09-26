-- HOLYHUB: reviewer feedback for lister applications.

alter table public.lister_applications
  add column rejection_reason text check (rejection_reason is null or char_length(rejection_reason) between 1 and 1000),
  add column reviewed_at timestamptz;

grant update (status, rejection_reason, reviewed_at, updated_at) on public.lister_applications to authenticated;