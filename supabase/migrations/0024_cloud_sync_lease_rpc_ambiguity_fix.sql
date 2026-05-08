create or replace function public.activate_cloud_sync_lease(
  input_user_id uuid,
  input_desktop_session_id uuid,
  input_device_id text,
  input_machine_code_hash text,
  input_expires_at timestamptz,
  input_now timestamptz
)
returns table(ok boolean, reason text, lease_id uuid, expires_at timestamptz, active_device_id text, available_after timestamptz, remaining_seconds integer, override_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_lease public.cloud_sync_leases%rowtype;
  session_row public.desktop_sessions%rowtype;
  active_lease public.cloud_sync_leases%rowtype;
  cooldown_lease public.cloud_sync_leases%rowtype;
  active_override_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0));

  select ds.*
  into session_row
  from public.desktop_sessions as ds
  where ds.id = input_desktop_session_id
    and ds.user_id = input_user_id
    and ds.device_id = input_device_id
    and ds.machine_code_hash = input_machine_code_hash
    and ds.revoked_at is null
    and ds.expires_at > input_now
  for update;

  if not found then
    return query select false, 'invalid_session'::text, null::uuid, null::timestamptz, null::text, null::timestamptz, null::integer, null::uuid;
    return;
  end if;

  perform public.mark_cloud_sync_released_leases(input_user_id, input_now);

  select csl.*
  into active_lease
  from public.cloud_sync_leases as csl
  where csl.user_id = input_user_id
    and csl.revoked_at is null
  order by csl.created_at desc
  limit 1;

  if found and active_lease.desktop_session_id <> input_desktop_session_id then
    return query select false, 'active_on_another_device'::text, null::uuid, null::timestamptz, active_lease.device_id, null::timestamptz, null::integer, null::uuid;
    return;
  end if;

  active_override_id := public.has_active_cloud_sync_cooldown_override(input_user_id, input_now);

  if active_override_id is null then
    select csl.*
    into cooldown_lease
    from public.cloud_sync_leases as csl
    where csl.user_id = input_user_id
      and csl.revoked_at is not null
      and csl.cooldown_until is not null
      and csl.cooldown_until > input_now
      and csl.desktop_session_id <> input_desktop_session_id
    order by csl.cooldown_until desc
    limit 1;

    if found then
      return query select false, 'cooldown_waiting'::text, null::uuid, null::timestamptz, cooldown_lease.device_id, cooldown_lease.cooldown_until, ceil(extract(epoch from (cooldown_lease.cooldown_until - input_now)))::integer, null::uuid;
      return;
    end if;
  end if;

  if active_lease.id is not null and active_lease.desktop_session_id = input_desktop_session_id then
    update public.cloud_sync_leases as csl
    set last_heartbeat_at = input_now,
        expires_at = input_expires_at,
        updated_at = input_now
    where csl.id = active_lease.id
    returning csl.*
    into inserted_lease;
  else
    insert into public.cloud_sync_leases (
      user_id,
      desktop_session_id,
      device_id,
      machine_code_hash,
      lease_started_at,
      last_heartbeat_at,
      expires_at
    )
    values (
      session_row.user_id,
      session_row.id,
      session_row.device_id,
      session_row.machine_code_hash,
      input_now,
      input_now,
      input_expires_at
    )
    returning *
    into inserted_lease;
  end if;

  if active_override_id is not null then
    update public.cloud_sync_cooldown_overrides as csco
    set consumed_at = input_now
    where csco.id = active_override_id;
  end if;

  update public.desktop_sessions as ds
  set cloud_sync_active_until = input_expires_at,
      last_seen_at = input_now
  where ds.id = input_desktop_session_id
    and ds.user_id = input_user_id;

  return query select true, 'active'::text, inserted_lease.id, inserted_lease.expires_at, inserted_lease.device_id, null::timestamptz, null::integer, active_override_id;
end;
$$;

create or replace function public.heartbeat_cloud_sync_lease(
  input_user_id uuid,
  input_desktop_session_id uuid,
  input_expires_at timestamptz,
  input_now timestamptz
)
returns table(ok boolean, reason text, lease_id uuid, expires_at timestamptz, active_device_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_lease public.cloud_sync_leases%rowtype;
  session_row public.desktop_sessions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0));

  select ds.*
  into session_row
  from public.desktop_sessions as ds
  where ds.id = input_desktop_session_id
    and ds.user_id = input_user_id
    and ds.revoked_at is null
    and ds.expires_at > input_now
  for update;

  if not found then
    return query select false, 'invalid_session'::text, null::uuid, null::timestamptz, null::text;
    return;
  end if;

  perform public.mark_cloud_sync_released_leases(input_user_id, input_now);

  select csl.*
  into active_lease
  from public.cloud_sync_leases as csl
  where csl.user_id = input_user_id
    and csl.revoked_at is null
  order by csl.created_at desc
  limit 1;

  if not found then
    return query select false, 'lease_not_found'::text, null::uuid, null::timestamptz, null::text;
    return;
  end if;

  if active_lease.desktop_session_id <> input_desktop_session_id then
    return query select false, 'active_on_another_device'::text, null::uuid, null::timestamptz, active_lease.device_id;
    return;
  end if;

  update public.cloud_sync_leases as csl
  set last_heartbeat_at = input_now,
      expires_at = input_expires_at,
      updated_at = input_now
  where csl.id = active_lease.id
  returning csl.*
  into active_lease;

  update public.desktop_sessions as ds
  set cloud_sync_active_until = input_expires_at,
      last_seen_at = input_now
  where ds.id = input_desktop_session_id
    and ds.user_id = input_user_id;

  return query select true, 'active'::text, active_lease.id, active_lease.expires_at, active_lease.device_id;
end;
$$;

create or replace function public.read_cloud_sync_lease_status(
  input_user_id uuid,
  input_desktop_session_id uuid,
  input_now timestamptz
)
returns table(ok boolean, reason text, active_device_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_lease public.cloud_sync_leases%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0));
  perform public.mark_cloud_sync_released_leases(input_user_id, input_now);

  select csl.*
  into active_lease
  from public.cloud_sync_leases as csl
  where csl.user_id = input_user_id
    and csl.revoked_at is null
  order by csl.created_at desc
  limit 1;

  if not found then
    return query select true, 'active'::text, null::text;
    return;
  end if;

  if active_lease.desktop_session_id <> input_desktop_session_id then
    return query select false, 'active_on_another_device'::text, active_lease.device_id;
    return;
  end if;

  return query select true, 'active'::text, active_lease.device_id;
end;
$$;

create or replace function public.release_cloud_sync_lease(
  input_user_id uuid,
  input_desktop_session_id uuid,
  input_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0));

  update public.cloud_sync_leases as csl
  set revoked_at = input_now,
      released_at = coalesce(csl.released_at, input_now),
      cooldown_until = coalesce(csl.cooldown_until, input_now + make_interval(mins => public.get_cloud_sync_cooldown_minutes())),
      updated_at = input_now
  where csl.user_id = input_user_id
    and csl.desktop_session_id = input_desktop_session_id
    and csl.revoked_at is null;

  update public.desktop_sessions as ds
  set cloud_sync_active_until = null,
      last_seen_at = input_now
  where ds.id = input_desktop_session_id
    and ds.user_id = input_user_id;

  return true;
end;
$$;

revoke execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) from public;
revoke execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) from anon;
revoke execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) from authenticated;
grant execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) to service_role;

revoke execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) from public;
revoke execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) from authenticated;
grant execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) to service_role;

revoke execute on function public.read_cloud_sync_lease_status(uuid, uuid, timestamptz) from public;
revoke execute on function public.read_cloud_sync_lease_status(uuid, uuid, timestamptz) from anon;
revoke execute on function public.read_cloud_sync_lease_status(uuid, uuid, timestamptz) from authenticated;
grant execute on function public.read_cloud_sync_lease_status(uuid, uuid, timestamptz) to service_role;

revoke execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) from public;
revoke execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) from anon;
revoke execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) from authenticated;
grant execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) to service_role;
