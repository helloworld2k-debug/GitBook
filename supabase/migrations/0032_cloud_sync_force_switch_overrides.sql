alter table public.cloud_sync_cooldown_overrides
  add column if not exists override_type text not null default 'skip_cooldown',
  add column if not exists target_machine_code_hash text,
  add column if not exists target_device_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cloud_sync_cooldown_overrides_type_check'
      and conrelid = 'public.cloud_sync_cooldown_overrides'::regclass
  ) then
    alter table public.cloud_sync_cooldown_overrides
      add constraint cloud_sync_cooldown_overrides_type_check
      check (override_type in ('skip_cooldown', 'force_switch'));
  end if;
end;
$$;

create index if not exists cloud_sync_cooldown_overrides_target_idx
on public.cloud_sync_cooldown_overrides (user_id, override_type, target_machine_code_hash, expires_at)
where consumed_at is null;

create or replace function public.find_active_cloud_sync_override(
  input_user_id uuid,
  input_override_type text,
  input_machine_code_hash text,
  input_now timestamptz
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id
  from public.cloud_sync_cooldown_overrides
  where user_id = input_user_id
    and consumed_at is null
    and expires_at > input_now
    and override_type = input_override_type
    and (target_machine_code_hash is null or target_machine_code_hash = input_machine_code_hash)
  order by created_at asc
  limit 1;
$$;

revoke execute on function public.find_active_cloud_sync_override(uuid, text, text, timestamptz) from public;
revoke execute on function public.find_active_cloud_sync_override(uuid, text, text, timestamptz) from anon;
revoke execute on function public.find_active_cloud_sync_override(uuid, text, text, timestamptz) from authenticated;
grant execute on function public.find_active_cloud_sync_override(uuid, text, text, timestamptz) to service_role;

create or replace function public.has_active_cloud_sync_cooldown_override(
  input_user_id uuid,
  input_now timestamptz
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.find_active_cloud_sync_override(input_user_id, 'skip_cooldown', null, input_now);
$$;

create or replace function public.activate_cloud_sync_lease(
  input_user_id uuid,
  input_desktop_session_id uuid,
  input_device_id text,
  input_machine_code_hash text,
  input_expires_at timestamptz,
  input_now timestamptz
)
returns table(ok boolean, reason text, lease_id uuid, expires_at timestamptz, active_device_id text, available_after timestamptz, remaining_seconds integer, override_id uuid, usage_session_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_lease public.cloud_sync_leases%rowtype;
  session_row public.desktop_sessions%rowtype;
  active_lease public.cloud_sync_leases%rowtype;
  cooldown_lease public.cloud_sync_leases%rowtype;
  skip_cooldown_override_id uuid;
  force_switch_override_id uuid;
  active_usage_session public.cloud_sync_usage_sessions%rowtype;
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
    return query select false, 'invalid_session'::text, null::uuid, null::timestamptz, null::text, null::timestamptz, null::integer, null::uuid, null::uuid;
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

  if found and active_lease.machine_code_hash <> session_row.machine_code_hash then
    force_switch_override_id := public.find_active_cloud_sync_override(
      input_user_id,
      'force_switch',
      session_row.machine_code_hash,
      input_now
    );

    if force_switch_override_id is null then
      perform public.record_cloud_sync_usage_event(
        input_user_id,
        active_lease.id,
        input_desktop_session_id,
        input_device_id,
        input_machine_code_hash,
        'activate_conflict',
        'active_on_another_device',
        jsonb_build_object('active_device_id', active_lease.device_id),
        input_now
      );
      return query select false, 'active_on_another_device'::text, null::uuid, null::timestamptz, active_lease.device_id, null::timestamptz, null::integer, null::uuid, null::uuid;
      return;
    end if;

    update public.cloud_sync_leases as csl
    set revoked_at = input_now,
        released_at = coalesce(csl.released_at, input_now),
        cooldown_until = coalesce(csl.cooldown_until, input_now + make_interval(mins => public.get_cloud_sync_cooldown_minutes())),
        updated_at = input_now
    where csl.id = active_lease.id;

    perform public.close_cloud_sync_usage_session(active_lease.id, input_now, 'admin_revoked');

    perform public.record_cloud_sync_usage_event(
      input_user_id,
      active_lease.id,
      input_desktop_session_id,
      input_device_id,
      input_machine_code_hash,
      'activate_conflict',
      'admin_force_switch',
      jsonb_build_object('active_device_id', active_lease.device_id, 'override_id', force_switch_override_id),
      input_now
    );

    active_lease := null;
  end if;

  skip_cooldown_override_id := public.find_active_cloud_sync_override(
    input_user_id,
    'skip_cooldown',
    session_row.machine_code_hash,
    input_now
  );

  if skip_cooldown_override_id is null and force_switch_override_id is null then
    select csl.*
    into cooldown_lease
    from public.cloud_sync_leases as csl
    where csl.user_id = input_user_id
      and csl.revoked_at is not null
      and csl.cooldown_until is not null
      and csl.cooldown_until > input_now
      and csl.machine_code_hash <> session_row.machine_code_hash
    order by csl.cooldown_until desc
    limit 1;

    if found then
      perform public.record_cloud_sync_usage_event(
        input_user_id,
        cooldown_lease.id,
        input_desktop_session_id,
        input_device_id,
        input_machine_code_hash,
        'cooldown_waiting',
        'cooldown_waiting',
        jsonb_build_object('available_after', cooldown_lease.cooldown_until),
        input_now
      );
      return query select false, 'cooldown_waiting'::text, null::uuid, null::timestamptz, cooldown_lease.device_id, cooldown_lease.cooldown_until, ceil(extract(epoch from (cooldown_lease.cooldown_until - input_now)))::integer, null::uuid, null::uuid;
      return;
    end if;
  end if;

  if active_lease.id is not null then
    if active_lease.desktop_session_id <> session_row.id then
      perform public.record_cloud_sync_usage_event(
        input_user_id,
        active_lease.id,
        session_row.id,
        session_row.device_id,
        session_row.machine_code_hash,
        'same_machine_takeover',
        'same_machine_takeover',
        jsonb_build_object('previous_desktop_session_id', active_lease.desktop_session_id),
        input_now
      );
    end if;

    update public.cloud_sync_leases as csl
    set desktop_session_id = session_row.id,
        device_id = session_row.device_id,
        machine_code_hash = session_row.machine_code_hash,
        last_heartbeat_at = input_now,
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

  select *
  into active_usage_session
  from public.cloud_sync_usage_sessions
  where id = public.open_cloud_sync_usage_session(
    session_row.user_id,
    inserted_lease.id,
    session_row.id,
    session_row.device_id,
    session_row.machine_code_hash,
    input_now
  );

  perform public.record_cloud_sync_usage_event(
    session_row.user_id,
    inserted_lease.id,
    session_row.id,
    session_row.device_id,
    session_row.machine_code_hash,
    'activate_success',
    case when force_switch_override_id is not null then 'force_switch_consumed' else 'active' end,
    jsonb_build_object('override_id', coalesce(force_switch_override_id, skip_cooldown_override_id)),
    input_now
  );

  if force_switch_override_id is not null or skip_cooldown_override_id is not null then
    update public.cloud_sync_cooldown_overrides as csco
    set consumed_at = input_now
    where csco.id = coalesce(force_switch_override_id, skip_cooldown_override_id);
  end if;

  update public.desktop_sessions as ds
  set cloud_sync_active_until = input_expires_at,
      last_seen_at = input_now
  where ds.id = input_desktop_session_id
    and ds.user_id = input_user_id;

  return query select true, 'active'::text, inserted_lease.id, inserted_lease.expires_at, inserted_lease.device_id, null::timestamptz, null::integer, coalesce(force_switch_override_id, skip_cooldown_override_id), active_usage_session.id;
end;
$$;
