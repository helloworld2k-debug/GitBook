alter table public.profiles
  add column if not exists admin_role text not null default 'user'
    check (admin_role in ('owner', 'operator', 'user')),
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'disabled'));

update public.profiles
set admin_role = 'owner'
where is_admin = true
  and admin_role = 'user';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and account_status = 'active'
      and (is_admin = true or admin_role in ('owner', 'operator'))
  );
$$;

alter table public.trial_code_redemptions
  alter column machine_code_hash drop not null,
  add column if not exists bound_at timestamptz,
  add column if not exists desktop_session_id uuid references public.desktop_sessions(id) on delete set null,
  add column if not exists device_id text;

create index if not exists trial_code_redemptions_machine_idx
on public.trial_code_redemptions (machine_code_hash)
where machine_code_hash is not null;

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

  if not trial.is_active or input_now < trial.starts_at or input_now > trial.ends_at then
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
    where trial_code_id = trial.id
      and user_id = input_user_id
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

create or replace function public.exchange_desktop_auth_code(
  input_code_hash text,
  input_token_hash text,
  input_device_id text,
  input_machine_code_hash text,
  input_platform text,
  input_app_version text,
  input_device_name text,
  input_session_expires_at timestamptz,
  input_now timestamptz
)
returns table(user_id uuid, desktop_session_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user_id uuid;
  inserted_session_id uuid;
  redemption public.trial_code_redemptions%rowtype;
begin
  update public.desktop_auth_codes
  set used_at = input_now
  where code_hash = input_code_hash
    and used_at is null
    and expires_at > input_now
  returning desktop_auth_codes.user_id
  into auth_user_id;

  if auth_user_id is null then
    return;
  end if;

  if exists (
    select 1
    from public.profiles
    where id = auth_user_id
      and account_status = 'disabled'
  ) then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(input_machine_code_hash, 0));

  insert into public.desktop_devices (
    user_id,
    device_id,
    machine_code_hash,
    platform,
    app_version,
    device_name,
    last_seen_at
  )
  values (
    auth_user_id,
    input_device_id,
    input_machine_code_hash,
    input_platform,
    input_app_version,
    input_device_name,
    input_now
  )
  on conflict (user_id, device_id)
  do update set
    machine_code_hash = excluded.machine_code_hash,
    platform = excluded.platform,
    app_version = excluded.app_version,
    device_name = excluded.device_name,
    last_seen_at = excluded.last_seen_at;

  insert into public.desktop_sessions (
    user_id,
    token_hash,
    device_id,
    machine_code_hash,
    platform,
    app_version,
    last_seen_at,
    expires_at
  )
  values (
    auth_user_id,
    input_token_hash,
    input_device_id,
    input_machine_code_hash,
    input_platform,
    input_app_version,
    input_now,
    input_session_expires_at
  )
  returning id
  into inserted_session_id;

  select *
  into redemption
  from public.trial_code_redemptions
  where user_id = auth_user_id
    and feature_code = 'cloud_sync'
    and trial_valid_until > input_now
    and machine_code_hash is null
  order by redeemed_at asc
  limit 1
  for update;

  if found then
    if exists (
      select 1
      from public.machine_trial_claims
      where machine_code_hash = input_machine_code_hash
        and feature_code = 'cloud_sync'
    ) then
      update public.trial_code_redemptions
      set desktop_session_id = inserted_session_id,
          device_id = input_device_id
      where id = redemption.id;
    else
      insert into public.machine_trial_claims (
        machine_code_hash,
        user_id,
        trial_code_id,
        feature_code,
        trial_started_at,
        trial_valid_until
      )
      values (
        input_machine_code_hash,
        auth_user_id,
        redemption.trial_code_id,
        'cloud_sync',
        redemption.redeemed_at,
        redemption.trial_valid_until
      );

      update public.trial_code_redemptions
      set machine_code_hash = input_machine_code_hash,
          bound_at = input_now,
          desktop_session_id = inserted_session_id,
          device_id = input_device_id
      where id = redemption.id;
    end if;
  end if;

  return query select auth_user_id, inserted_session_id;
end;
$$;

revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz) from public;
revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz) from anon;
revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz) from authenticated;
grant execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz) to service_role;
