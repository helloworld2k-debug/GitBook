update public.trial_codes
set is_active = false,
    updated_at = now()
where deleted_at is null
  and duration_kind in ('month_1', 'month_3', 'year_1')
  and is_active = true;

create or replace function public.redeem_trial_code(
  input_user_id uuid,
  input_code_hash text,
  input_now timestamptz
)
returns table(ok boolean, reason text, valid_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  trial public.trial_codes%rowtype;
  trial_valid_until timestamptz;
begin
  select *
  into trial
  from public.trial_codes
  where code_hash = input_code_hash
  for update;

  if not found then
    return query select false, 'trial_code_invalid'::text, null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(trial.id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0));

  if not trial.is_active or trial.deleted_at is not null then
    return query select false, 'trial_code_inactive'::text, null::timestamptz;
    return;
  end if;

  if trial.duration_kind <> 'trial_3_day' then
    return query select false, 'trial_code_inactive'::text, null::timestamptz;
    return;
  end if;

  if trial.trial_days < 1 or trial.trial_days > 7 then
    return query select false, 'trial_code_inactive'::text, null::timestamptz;
    return;
  end if;

  if trial.max_redemptions is not null and trial.redemption_count >= trial.max_redemptions then
    return query select false, 'trial_code_limit_reached'::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1
    from public.trial_code_redemptions
    where user_id = input_user_id
      and feature_code = 'cloud_sync'
  ) then
    return query select false, 'duplicate_trial_code_user'::text, null::timestamptz;
    return;
  end if;

  trial_valid_until := input_now + make_interval(days => trial.trial_days);

  insert into public.trial_code_redemptions (
    trial_code_id,
    user_id,
    machine_code_hash,
    feature_code,
    redeemed_at,
    trial_valid_until
  )
  values (
    trial.id,
    input_user_id,
    null,
    'cloud_sync',
    input_now,
    trial_valid_until
  );

  update public.trial_codes
  set redemption_count = redemption_count + 1,
      updated_at = input_now
  where id = trial.id;

  return query select true, 'redeemed'::text, trial_valid_until;
end;
$$;

revoke execute on function public.redeem_trial_code(uuid, text, timestamptz) from public;
revoke execute on function public.redeem_trial_code(uuid, text, timestamptz) from anon;
revoke execute on function public.redeem_trial_code(uuid, text, timestamptz) from authenticated;
grant execute on function public.redeem_trial_code(uuid, text, timestamptz) to service_role;
