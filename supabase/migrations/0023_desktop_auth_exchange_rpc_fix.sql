create or replace function public.exchange_desktop_auth_code(
  input_code_hash text,
  input_token_hash text,
  input_device_id text,
  input_machine_code_hash text,
  input_platform text,
  input_app_version text,
  input_device_name text,
  input_state text,
  input_session_expires_at timestamptz,
  input_now timestamptz
)
returns table(user_id uuid, desktop_session_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_user_id uuid;
  inserted_session_id uuid;
begin
  update public.desktop_auth_codes as dac
  set used_at = input_now
  where dac.code_hash = input_code_hash
    and dac.state = input_state
    and dac.used_at is null
    and dac.expires_at > input_now
  returning dac.user_id
  into claimed_user_id;

  if claimed_user_id is null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(claimed_user_id::text, 0));

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
    claimed_user_id,
    input_device_id,
    input_machine_code_hash,
    input_platform,
    input_app_version,
    input_device_name,
    input_now
  )
  on conflict on constraint desktop_devices_user_id_device_id_key
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
    claimed_user_id,
    input_token_hash,
    input_device_id,
    input_machine_code_hash,
    input_platform,
    input_app_version,
    input_now,
    input_session_expires_at
  )
  returning desktop_sessions.id
  into inserted_session_id;

  return query select claimed_user_id, inserted_session_id;
end;
$$;

revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, text, timestamptz, timestamptz) from public;
revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, text, timestamptz, timestamptz) from anon;
revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, text, timestamptz, timestamptz) from authenticated;
grant execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, text, timestamptz, timestamptz) to service_role;
