alter table public.payment_product_settings
  drop constraint if exists payment_product_settings_tier_code_check;

alter table public.payment_product_settings
  add constraint payment_product_settings_tier_code_check
  check (tier_code in ('one_day', 'monthly', 'quarterly', 'yearly'));

drop policy if exists "Public reads enabled Dodo payment product settings"
  on public.payment_product_settings;

create policy "Public reads enabled Dodo payment product settings"
  on public.payment_product_settings
  for select
  using (provider = 'dodo' and is_enabled = true);

insert into public.donation_tiers (
  code,
  label,
  description,
  amount,
  compare_at_amount,
  currency,
  sort_order,
  is_active,
  updated_at
)
values (
  'one_day',
  '1-Day Support',
  'A one-day live payment test support option for verifying checkout, certificate, and cloud sync entitlement flow.',
  100,
  null,
  'usd',
  0,
  true,
  now()
)
on conflict (code)
do update set
  label = excluded.label,
  description = excluded.description,
  amount = excluded.amount,
  compare_at_amount = excluded.compare_at_amount,
  currency = excluded.currency,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = excluded.updated_at;

insert into public.payment_product_settings (
  provider,
  environment,
  tier_code,
  product_id,
  is_enabled,
  updated_at
)
values
  ('dodo', 'live', 'one_day', 'pdt_0NfT90n9WltsyhcDAaVoj', true, now())
on conflict (provider, environment, tier_code)
do update set
  product_id = excluded.product_id,
  is_enabled = excluded.is_enabled,
  updated_at = excluded.updated_at;

create or replace function public.grant_cloud_sync_day_entitlement_for_donation(
  input_user_id uuid,
  input_donation_id uuid,
  input_days integer,
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
  grant_paid_at timestamptz;
  grant_valid_until timestamptz;
begin
  if input_days <= 0 then
    raise exception 'Entitlement days must be positive';
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

  grant_valid_until := grant_valid_from + make_interval(days => input_days);

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
    input_days,
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

revoke execute on function public.grant_cloud_sync_day_entitlement_for_donation(uuid, uuid, integer, timestamptz) from public;
revoke execute on function public.grant_cloud_sync_day_entitlement_for_donation(uuid, uuid, integer, timestamptz) from anon;
revoke execute on function public.grant_cloud_sync_day_entitlement_for_donation(uuid, uuid, integer, timestamptz) from authenticated;
grant execute on function public.grant_cloud_sync_day_entitlement_for_donation(uuid, uuid, integer, timestamptz) to service_role;
