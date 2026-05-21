-- Update license code redemption from days to calendar months
-- Using Beijing timezone (Asia/Shanghai) for month-based calculations
-- Trial codes (trial_3_day) continue to use days

-- Drop old functions
drop function if exists public.redeem_trial_code(uuid, text, timestamptz);
drop function if exists public.redeem_trial_code(uuid, text, text, timestamptz);
drop function if exists public.redeem_license_code(uuid, text, text, timestamptz);

-- Create new function with month-based calculation for non-trial codes
create or replace function public.redeem_license_code(
  input_user_id uuid,
  input_code_hash text,
  input_machine_code_hash text default null,
  input_now timestamptz default now()
)
returns table(ok boolean, reason text, valid_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  code public.trial_codes%rowtype;
  current_valid_until timestamptz;
  grant_valid_from timestamptz;
  grant_valid_from_beijing timestamp without time zone;
  grant_valid_until timestamptz;
  grant_months integer;
  grant_days integer;
begin
  select *
  into code
  from public.trial_codes
  where code_hash = input_code_hash
  for update;

  if not found then
    return query select false, 'trial_code_invalid'::text, null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(code.id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0));

  if not code.is_active or code.deleted_at is not null then
    return query select false, 'trial_code_inactive'::text, null::timestamptz;
    return;
  end if;

  if code.max_redemptions is not null and code.redemption_count >= code.max_redemptions then
    return query select false, 'trial_code_limit_reached'::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1
    from public.trial_code_redemptions
    where trial_code_id = code.id
      and user_id = input_user_id
      and feature_code = code.feature_code
  ) then
    return query select false, 'duplicate_trial_code_user'::text, null::timestamptz;
    return;
  end if;

  if code.duration_kind = 'trial_3_day' then
    if code.trial_days < 1 or code.trial_days > 7 then
      return query select false, 'trial_code_inactive'::text, null::timestamptz;
      return;
    end if;

    if exists (
      select 1
      from public.trial_code_redemptions redemption
      join public.trial_codes redeemed_code on redeemed_code.id = redemption.trial_code_id
      where redemption.user_id = input_user_id
        and redemption.feature_code = code.feature_code
        and redeemed_code.duration_kind = 'trial_3_day'
    ) then
      return query select false, 'duplicate_trial_code_user'::text, null::timestamptz;
    end if;

    if input_machine_code_hash is not null and exists (
      select 1
      from public.trial_code_redemptions redemption
      join public.trial_codes redeemed_code on redeemed_code.id = redemption.trial_code_id
      where redemption.machine_code_hash = input_machine_code_hash
        and redemption.feature_code = code.feature_code
        and redeemed_code.duration_kind = 'trial_3_day'
    ) then
      return query select false, 'duplicate_trial_code_machine'::text, null::timestamptz;
    end if;

    -- Trial codes use days (1-7 days as configured)
    grant_days := code.trial_days;

    select entitlement.valid_until
    into current_valid_until
    from public.license_entitlements entitlement
    where entitlement.user_id = input_user_id
      and entitlement.feature_code = code.feature_code
      and entitlement.status = 'active';

    if current_valid_until is not null and current_valid_until > input_now then
      grant_valid_from := current_valid_until;
    else
      grant_valid_from := input_now;
    end if;

    grant_valid_until := grant_valid_from + make_interval(days => grant_days);
  else
    -- Month-based codes use calendar months with Beijing timezone
    grant_months := case code.duration_kind
      when 'month_1' then 1
      when 'month_3' then 3
      when 'year_1' then 12
      else null
    end;

    if grant_months is null then
      return query select false, 'trial_code_inactive'::text, null::timestamptz;
      return;
    end if;

    select entitlement.valid_until
    into current_valid_until
    from public.license_entitlements entitlement
    where entitlement.user_id = input_user_id
      and entitlement.feature_code = code.feature_code
      and entitlement.status = 'active';

    if current_valid_until is not null and current_valid_until > input_now then
      grant_valid_from := current_valid_until;
    else
      grant_valid_from := input_now;
    end if;

    -- Convert to Beijing timezone for month-based calculation
    grant_valid_from_beijing := grant_valid_from AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai';
    grant_valid_until := (grant_valid_from_beijing + make_interval(months => grant_months))
                         AT TIME ZONE 'Asia/Shanghai' AT TIME ZONE 'UTC';
  end if;

  insert into public.license_entitlements (
    user_id,
    feature_code,
    valid_until,
    status,
    source_donation_id
  )
  values (
    input_user_id,
    code.feature_code,
    grant_valid_until,
    'active',
    null
  )
  on conflict (user_id, feature_code)
  do update set
    valid_until = greatest(public.license_entitlements.valid_until, excluded.valid_until),
    status = 'active',
    updated_at = input_now;

  insert into public.trial_code_redemptions (
    trial_code_id,
    user_id,
    machine_code_hash,
    feature_code,
    redeemed_at,
    trial_valid_until
  )
  values (
    code.id,
    input_user_id,
    input_machine_code_hash,
    code.feature_code,
    input_now,
    grant_valid_until
  );

  update public.trial_codes
  set redemption_count = redemption_count + 1,
      updated_at = input_now
  where id = code.id;

  return query select true, 'redeemed'::text, grant_valid_until;
end;
$$;

create or replace function public.redeem_trial_code(
  input_user_id uuid,
  input_code_hash text,
  input_machine_code_hash text,
  input_now timestamptz
)
returns table(ok boolean, reason text, valid_until timestamptz)
language sql
security definer
set search_path = public
as $$
  select * from public.redeem_license_code(input_user_id, input_code_hash, input_machine_code_hash, input_now);
$$;

create or replace function public.redeem_trial_code(
  input_user_id uuid,
  input_code_hash text,
  input_now timestamptz
)
returns table(ok boolean, reason text, valid_until timestamptz)
language sql
security definer
set search_path = public
as $$
  select * from public.redeem_license_code(input_user_id, input_code_hash, null, input_now);
$$;

revoke execute on function public.redeem_license_code(uuid, text, text, timestamptz) from public;
revoke execute on function public.redeem_license_code(uuid, text, text, timestamptz) from anon;
revoke execute on function public.redeem_license_code(uuid, text, text, timestamptz) from authenticated;
grant execute on function public.redeem_license_code(uuid, text, text, timestamptz) to service_role;
