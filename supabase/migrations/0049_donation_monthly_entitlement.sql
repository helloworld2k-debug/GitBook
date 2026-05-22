-- Update donation entitlement calculation from days to calendar months
-- Using Beijing timezone (Asia/Shanghai) for month-based calculations

-- Drop old function
drop function if exists public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz);

-- Create new function with month-based calculation
create or replace function public.grant_cloud_sync_entitlement_for_donation(
  input_user_id uuid,
  input_donation_id uuid,
  input_months integer,
  input_paid_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_valid_until timestamptz;
  current_valid_until timestamptz;
  donation_paid_at timestamptz;
  grant_valid_from timestamptz;
  grant_valid_from_beijing timestamp without time zone;
  grant_paid_at timestamptz;
  grant_valid_until timestamptz;
begin
  if input_months <= 0 then
    raise exception 'Entitlement months must be positive';
  end if;

  select paid_at
  into donation_paid_at
  from public.donations
  where id = input_donation_id
    and user_id = input_user_id
    and status = 'paid';

  if not found then
    raise exception 'Paid donation not found for entitlement grant';
  end if;

  grant_paid_at := coalesce(donation_paid_at, input_paid_at);

  select valid_until
  into existing_valid_until
  from public.license_entitlement_grants
  where source_donation_id = input_donation_id
    and feature_code = 'cloud_sync';

  if existing_valid_until is not null then
    return existing_valid_until;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0));

  select valid_until
  into existing_valid_until
  from public.license_entitlement_grants
  where source_donation_id = input_donation_id
    and feature_code = 'cloud_sync';

  if existing_valid_until is not null then
    return existing_valid_until;
  end if;

  select valid_until
  into current_valid_until
  from public.license_entitlements
  where user_id = input_user_id
    and feature_code = 'cloud_sync'
    and status = 'active';

  if current_valid_until is not null and current_valid_until > grant_paid_at then
    grant_valid_from := current_valid_until;
  else
    grant_valid_from := grant_paid_at;
  end if;

  -- Convert to Beijing timezone for month-based calculation
  grant_valid_from_beijing := grant_valid_from AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai';
  grant_valid_until := (grant_valid_from_beijing + make_interval(months => input_months))
                       AT TIME ZONE 'Asia/Shanghai' AT TIME ZONE 'UTC';

  insert into public.license_entitlement_grants (
    user_id,
    feature_code,
    source_donation_id,
    granted_days,
    valid_from,
    valid_until
  )
  values (
    input_user_id,
    'cloud_sync',
    input_donation_id,
    input_months,
    grant_valid_from,
    grant_valid_until
  );

  insert into public.license_entitlements (
    user_id,
    feature_code,
    valid_until,
    status,
    source_donation_id
  )
  values (
    input_user_id,
    'cloud_sync',
    grant_valid_until,
    'active',
    input_donation_id
  )
  on conflict (user_id, feature_code)
  do update set
    valid_until = excluded.valid_until,
    status = 'active',
    source_donation_id = excluded.source_donation_id,
    updated_at = now();

  return grant_valid_until;
end;
$$;

revoke execute on function public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz) from public;
revoke execute on function public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz) from anon;
revoke execute on function public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz) from authenticated;
grant execute on function public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz) to service_role;
