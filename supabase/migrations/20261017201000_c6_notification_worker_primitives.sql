-- C6 provider-neutral worker primitives. These functions do not send email.
-- A later transactional-provider adapter can claim jobs, render the pinned
-- template version, submit the message, then record the outcome/delivery event.

create or replace function public.claim_notification_outbox(
  p_limit integer default 10,
  p_lease_seconds integer default 300
)
returns table (
  id uuid,
  lease_token uuid,
  kind text,
  template_version integer,
  order_id uuid,
  recipient_email text,
  payload jsonb,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service access is required.';
  end if;
  if p_limit < 1 or p_limit > 50 or p_lease_seconds < 30 or p_lease_seconds > 1800 then
    raise exception 'Invalid notification worker claim limits.';
  end if;

  return query
  with candidates as (
    select n.id
    from public.notification_outbox n
    where (
      n.state = 'pending'
      and (n.next_attempt_at is null or n.next_attempt_at <= now())
    ) or (
      n.state = 'processing'
      and n.lease_expires_at is not null
      and n.lease_expires_at <= now()
    )
    order by n.created_at, n.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.notification_outbox n
    set state = 'processing',
        lease_token = gen_random_uuid(),
        lease_expires_at = now() + (p_lease_seconds * interval '1 second'),
        updated_at = now()
    from candidates c
    where n.id = c.id
    returning n.id, n.lease_token, n.kind, n.template_version, n.order_id,
      n.recipient_email, n.payload, n.attempt_count
  )
  select c.id, c.lease_token, c.kind, c.template_version, c.order_id,
    c.recipient_email, c.payload, c.attempt_count
  from claimed c;
end;
$$;

revoke all on function public.claim_notification_outbox(integer, integer) from public;
grant execute on function public.claim_notification_outbox(integer, integer) to service_role;

create or replace function public.finish_notification_attempt(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_provider_message_id text default null,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.notification_outbox;
  next_attempt integer;
  backoff_minutes integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service access is required.';
  end if;
  if p_outcome not in ('accepted', 'temporary_failure', 'permanent_failure', 'unknown') then
    raise exception 'Invalid notification outcome.';
  end if;

  select * into job
  from public.notification_outbox
  where id = p_outbox_id
    and state = 'processing'
    and lease_token = p_lease_token
  for update;

  if not found then
    return false;
  end if;

  next_attempt := job.attempt_count + 1;
  insert into public.notification_attempts (
    outbox_id, attempt_number, outcome, provider_message_id, error_code
  ) values (
    job.id, next_attempt, p_outcome, nullif(btrim(p_provider_message_id), ''), nullif(btrim(p_error_code), '')
  );

  if p_outcome = 'accepted' then
    update public.notification_outbox
    set state = 'sent',
        attempt_count = next_attempt,
        last_attempt_at = now(),
        next_attempt_at = null,
        lease_token = null,
        lease_expires_at = null,
        provider_message_id = nullif(btrim(p_provider_message_id), ''),
        sent_at = now(),
        updated_at = now()
    where id = job.id;
  elsif p_outcome = 'temporary_failure' then
    backoff_minutes := least(60, power(2, least(next_attempt, 6))::integer);
    update public.notification_outbox
    set state = 'pending',
        attempt_count = next_attempt,
        last_attempt_at = now(),
        next_attempt_at = now() + (backoff_minutes * interval '1 minute'),
        lease_token = null,
        lease_expires_at = null,
        updated_at = now()
    where id = job.id;
  elsif p_outcome = 'permanent_failure' then
    update public.notification_outbox
    set state = 'failed',
        attempt_count = next_attempt,
        last_attempt_at = now(),
        next_attempt_at = null,
        lease_token = null,
        lease_expires_at = null,
        provider_message_id = coalesce(nullif(btrim(p_provider_message_id), ''), provider_message_id),
        updated_at = now()
    where id = job.id;
  else
    update public.notification_outbox
    set state = 'unknown',
        attempt_count = next_attempt,
        last_attempt_at = now(),
        next_attempt_at = null,
        lease_token = null,
        lease_expires_at = null,
        provider_message_id = coalesce(nullif(btrim(p_provider_message_id), ''), provider_message_id),
        updated_at = now()
    where id = job.id;
  end if;

  return true;
end;
$$;

revoke all on function public.finish_notification_attempt(uuid, uuid, text, text, text) from public;
grant execute on function public.finish_notification_attempt(uuid, uuid, text, text, text) to service_role;

create or replace function public.record_notification_delivery(
  p_provider_message_id text,
  p_delivery_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service access is required.';
  end if;
  if p_delivery_status not in ('delivered', 'bounced', 'failed', 'complained', 'unknown') then
    raise exception 'Invalid delivery status.';
  end if;

  update public.notification_outbox
  set delivery_status = p_delivery_status,
      delivered_at = case when p_delivery_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
      updated_at = now()
  where provider_message_id = p_provider_message_id;

  return found;
end;
$$;

revoke all on function public.record_notification_delivery(text, text) from public;
grant execute on function public.record_notification_delivery(text, text) to service_role;
