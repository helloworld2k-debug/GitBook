alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'disabled', 'deleted'));

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
      and account_status in ('disabled', 'deleted')
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
    delete from public.machine_trial_claims
    where machine_code_hash = input_machine_code_hash
      and feature_code = 'cloud_sync';

    insert into public.machine_trial_claims (
      machine_code_hash,
      feature_code,
      trial_redemption_id,
      user_id,
      claimed_at
    )
    values (
      input_machine_code_hash,
      'cloud_sync',
      redemption.id,
      auth_user_id,
      input_now
    );

    update public.trial_code_redemptions
    set machine_code_hash = input_machine_code_hash,
        desktop_session_id = inserted_session_id,
        device_id = input_device_id,
        bound_at = input_now
    where id = redemption.id;
  end if;

  return query
  select auth_user_id, inserted_session_id;
end;
$$;
