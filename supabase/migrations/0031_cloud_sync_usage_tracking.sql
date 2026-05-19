create table public.cloud_sync_usage_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lease_id uuid not null references public.cloud_sync_leases(id) on delete cascade,
  desktop_session_id uuid not null references public.desktop_sessions(id) on delete cascade,
  device_id text not null,
  machine_code_hash text not null,
  started_at timestamptz not null,
  last_heartbeat_at timestamptz not null,
  ended_at timestamptz,
  end_reason text check (
    end_reason is null or end_reason in (
      'released',
      'heartbeat_timeout',
      'admin_revoked',
      'same_machine_takeover',
      'session_revoked',
      'historical_inferred'
    )
  ),
  heartbeat_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id)
);

create table public.cloud_sync_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lease_id uuid references public.cloud_sync_leases(id) on delete set null,
  desktop_session_id uuid references public.desktop_sessions(id) on delete set null,
  device_id text,
  machine_code_hash text,
  event_type text not null check (
    event_type in (
      'activate_success',
      'activate_conflict',
      'cooldown_waiting',
      'same_machine_takeover',
      'heartbeat_success',
      'release',
      'admin_revoke',
      'support_denied'
    )
  ),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index cloud_sync_usage_sessions_user_started_idx
on public.cloud_sync_usage_sessions (user_id, started_at desc);

create index cloud_sync_usage_sessions_lease_idx
on public.cloud_sync_usage_sessions (lease_id);

create index cloud_sync_usage_sessions_machine_idx
on public.cloud_sync_usage_sessions (user_id, machine_code_hash, started_at desc);

create index cloud_sync_usage_events_user_occurred_idx
on public.cloud_sync_usage_events (user_id, occurred_at desc);

create index cloud_sync_usage_events_type_occurred_idx
on public.cloud_sync_usage_events (event_type, occurred_at desc);

alter table public.cloud_sync_usage_sessions enable row level security;
alter table public.cloud_sync_usage_events enable row level security;

create policy "cloud_sync_usage_sessions_admin_all"
  on public.cloud_sync_usage_sessions for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "cloud_sync_usage_events_admin_all"
  on public.cloud_sync_usage_events for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.record_cloud_sync_usage_event(
  input_user_id uuid,
  input_lease_id uuid,
  input_desktop_session_id uuid,
  input_device_id text,
  input_machine_code_hash text,
  input_event_type text,
  input_reason text,
  input_metadata jsonb,
  input_now timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  insert into public.cloud_sync_usage_events (
    user_id,
    lease_id,
    desktop_session_id,
    device_id,
    machine_code_hash,
    event_type,
    reason,
    metadata,
    occurred_at
  )
  values (
    input_user_id,
    input_lease_id,
    input_desktop_session_id,
    input_device_id,
    input_machine_code_hash,
    input_event_type,
    input_reason,
    coalesce(input_metadata, '{}'::jsonb),
    input_now
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.open_cloud_sync_usage_session(
  input_user_id uuid,
  input_lease_id uuid,
  input_desktop_session_id uuid,
  input_device_id text,
  input_machine_code_hash text,
  input_now timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  active_usage_session_id uuid;
begin
  insert into public.cloud_sync_usage_sessions (
    user_id,
    lease_id,
    desktop_session_id,
    device_id,
    machine_code_hash,
    started_at,
    last_heartbeat_at,
    heartbeat_count,
    updated_at
  )
  values (
    input_user_id,
    input_lease_id,
    input_desktop_session_id,
    input_device_id,
    input_machine_code_hash,
    input_now,
    input_now,
    1,
    input_now
  )
  on conflict (lease_id) do update
  set desktop_session_id = excluded.desktop_session_id,
      device_id = excluded.device_id,
      machine_code_hash = excluded.machine_code_hash,
      last_heartbeat_at = excluded.last_heartbeat_at,
      heartbeat_count = public.cloud_sync_usage_sessions.heartbeat_count + 1,
      updated_at = excluded.updated_at
  returning id into active_usage_session_id;

  return active_usage_session_id;
end;
$$;

create or replace function public.touch_cloud_sync_usage_session(
  input_lease_id uuid,
  input_desktop_session_id uuid,
  input_device_id text,
  input_machine_code_hash text,
  input_now timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  active_usage_session_id uuid;
begin
  update public.cloud_sync_usage_sessions
  set desktop_session_id = input_desktop_session_id,
      device_id = input_device_id,
      machine_code_hash = input_machine_code_hash,
      last_heartbeat_at = input_now,
      heartbeat_count = heartbeat_count + 1,
      updated_at = input_now
  where lease_id = input_lease_id
    and ended_at is null
  returning id into active_usage_session_id;

  return active_usage_session_id;
end;
$$;

create or replace function public.close_cloud_sync_usage_session(
  input_lease_id uuid,
  input_ended_at timestamptz,
  input_end_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cloud_sync_usage_sessions
  set ended_at = coalesce(ended_at, input_ended_at),
      end_reason = coalesce(end_reason, input_end_reason),
      updated_at = input_ended_at
  where lease_id = input_lease_id
    and ended_at is null;
end;
$$;

insert into public.cloud_sync_usage_sessions (
  user_id,
  lease_id,
  desktop_session_id,
  device_id,
  machine_code_hash,
  started_at,
  last_heartbeat_at,
  ended_at,
  end_reason,
  heartbeat_count,
  created_at,
  updated_at
)
select
  csl.user_id,
  csl.id,
  csl.desktop_session_id,
  csl.device_id,
  csl.machine_code_hash,
  csl.lease_started_at,
  csl.last_heartbeat_at,
  case
    when csl.revoked_at is not null then coalesce(csl.released_at, csl.revoked_at)
    when csl.expires_at <= now() then csl.expires_at
    else null
  end,
  case
    when csl.revoked_at is not null or csl.expires_at <= now() then 'historical_inferred'
    else null
  end,
  1,
  csl.created_at,
  csl.updated_at
from public.cloud_sync_leases as csl
on conflict (lease_id) do nothing;

create or replace function public.mark_cloud_sync_released_leases(
  input_user_id uuid,
  input_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cooldown_interval interval;
  expired_lease public.cloud_sync_leases%rowtype;
begin
  cooldown_interval := make_interval(mins => public.get_cloud_sync_cooldown_minutes());

  for expired_lease in
    update public.cloud_sync_leases
    set revoked_at = coalesce(revoked_at, expires_at),
        released_at = coalesce(released_at, expires_at),
        cooldown_until = coalesce(cooldown_until, expires_at + cooldown_interval),
        updated_at = input_now
    where user_id = input_user_id
      and revoked_at is null
      and expires_at <= input_now
    returning *
  loop
    perform public.close_cloud_sync_usage_session(expired_lease.id, expired_lease.expires_at, 'heartbeat_timeout');
  end loop;

  update public.desktop_sessions
  set cloud_sync_active_until = null
  where user_id = input_user_id
    and cloud_sync_active_until is not null
    and cloud_sync_active_until <= input_now;
end;
$$;

drop function if exists public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz);

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
  active_override_id uuid;
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

  active_override_id := public.has_active_cloud_sync_cooldown_override(input_user_id, input_now);

  if active_override_id is null then
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
    'active',
    jsonb_build_object('override_id', active_override_id),
    input_now
  );

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

  return query select true, 'active'::text, inserted_lease.id, inserted_lease.expires_at, inserted_lease.device_id, null::timestamptz, null::integer, active_override_id, active_usage_session.id;
end;
$$;

drop function if exists public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz);

create or replace function public.heartbeat_cloud_sync_lease(
  input_user_id uuid,
  input_desktop_session_id uuid,
  input_expires_at timestamptz,
  input_now timestamptz
)
returns table(ok boolean, reason text, lease_id uuid, expires_at timestamptz, active_device_id text, usage_session_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_lease public.cloud_sync_leases%rowtype;
  session_row public.desktop_sessions%rowtype;
  active_usage_session_id uuid;
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
    return query select false, 'invalid_session'::text, null::uuid, null::timestamptz, null::text, null::uuid;
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
    return query select false, 'lease_not_found'::text, null::uuid, null::timestamptz, null::text, null::uuid;
    return;
  end if;

  if active_lease.desktop_session_id <> input_desktop_session_id then
    return query select false, 'active_on_another_device'::text, null::uuid, null::timestamptz, active_lease.device_id, null::uuid;
    return;
  end if;

  update public.cloud_sync_leases as csl
  set last_heartbeat_at = input_now,
      expires_at = input_expires_at,
      updated_at = input_now
  where csl.id = active_lease.id
  returning csl.*
  into active_lease;

  active_usage_session_id := public.touch_cloud_sync_usage_session(
    active_lease.id,
    session_row.id,
    session_row.device_id,
    session_row.machine_code_hash,
    input_now
  );

  if active_usage_session_id is null then
    active_usage_session_id := public.open_cloud_sync_usage_session(
      session_row.user_id,
      active_lease.id,
      session_row.id,
      session_row.device_id,
      session_row.machine_code_hash,
      input_now
    );
  end if;

  perform public.record_cloud_sync_usage_event(
    session_row.user_id,
    active_lease.id,
    session_row.id,
    session_row.device_id,
    session_row.machine_code_hash,
    'heartbeat_success',
    'active',
    '{}'::jsonb,
    input_now
  );

  update public.desktop_sessions as ds
  set cloud_sync_active_until = input_expires_at,
      last_seen_at = input_now
  where ds.id = input_desktop_session_id
    and ds.user_id = input_user_id;

  return query select true, 'active'::text, active_lease.id, active_lease.expires_at, active_lease.device_id, active_usage_session_id;
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
declare
  released_lease public.cloud_sync_leases%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0));

  for released_lease in
    update public.cloud_sync_leases as csl
    set revoked_at = input_now,
        released_at = coalesce(csl.released_at, input_now),
        cooldown_until = coalesce(csl.cooldown_until, input_now + make_interval(mins => public.get_cloud_sync_cooldown_minutes())),
        updated_at = input_now
    where csl.user_id = input_user_id
      and csl.desktop_session_id = input_desktop_session_id
      and csl.revoked_at is null
    returning *
  loop
    perform public.close_cloud_sync_usage_session(released_lease.id, input_now, 'released');
    perform public.record_cloud_sync_usage_event(
      released_lease.user_id,
      released_lease.id,
      released_lease.desktop_session_id,
      released_lease.device_id,
      released_lease.machine_code_hash,
      'release',
      'released',
      '{}'::jsonb,
      input_now
    );
  end loop;

  update public.desktop_sessions as ds
  set cloud_sync_active_until = null,
      last_seen_at = input_now
  where ds.id = input_desktop_session_id
    and ds.user_id = input_user_id;

  return true;
end;
$$;

create or replace function public.revoke_desktop_session_with_leases(
  input_desktop_session_id uuid,
  input_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.desktop_sessions%rowtype;
  revoked_lease public.cloud_sync_leases%rowtype;
begin
  select *
  into session_row
  from public.desktop_sessions
  where id = input_desktop_session_id;

  if not found then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(session_row.user_id::text, 0));

  select *
  into session_row
  from public.desktop_sessions
  where id = input_desktop_session_id
  for update;

  if not found then
    return false;
  end if;

  update public.desktop_sessions
  set revoked_at = input_now,
      cloud_sync_active_until = null,
      last_seen_at = input_now
  where id = input_desktop_session_id;

  for revoked_lease in
    update public.cloud_sync_leases
    set revoked_at = input_now,
        released_at = coalesce(released_at, input_now),
        cooldown_until = coalesce(cooldown_until, input_now + make_interval(mins => public.get_cloud_sync_cooldown_minutes())),
        updated_at = input_now
    where desktop_session_id = input_desktop_session_id
      and revoked_at is null
    returning *
  loop
    perform public.close_cloud_sync_usage_session(revoked_lease.id, input_now, 'session_revoked');
    perform public.record_cloud_sync_usage_event(
      revoked_lease.user_id,
      revoked_lease.id,
      revoked_lease.desktop_session_id,
      revoked_lease.device_id,
      revoked_lease.machine_code_hash,
      'admin_revoke',
      'session_revoked',
      '{}'::jsonb,
      input_now
    );
  end loop;

  return true;
end;
$$;

create or replace function public.revoke_cloud_sync_lease_with_usage(
  input_cloud_sync_lease_id uuid,
  input_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  lease_row public.cloud_sync_leases%rowtype;
begin
  select *
  into lease_row
  from public.cloud_sync_leases
  where id = input_cloud_sync_lease_id;

  if not found then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lease_row.user_id::text, 0));

  update public.cloud_sync_leases
  set revoked_at = input_now,
      released_at = coalesce(released_at, input_now),
      cooldown_until = coalesce(cooldown_until, input_now + make_interval(mins => public.get_cloud_sync_cooldown_minutes())),
      updated_at = input_now
  where id = input_cloud_sync_lease_id
    and revoked_at is null
  returning *
  into lease_row;

  if not found then
    return true;
  end if;

  perform public.close_cloud_sync_usage_session(lease_row.id, input_now, 'admin_revoked');
  perform public.record_cloud_sync_usage_event(
    lease_row.user_id,
    lease_row.id,
    lease_row.desktop_session_id,
    lease_row.device_id,
    lease_row.machine_code_hash,
    'admin_revoke',
    'admin_revoked',
    '{}'::jsonb,
    input_now
  );

  update public.desktop_sessions
  set cloud_sync_active_until = null,
      last_seen_at = input_now
  where id = lease_row.desktop_session_id;

  return true;
end;
$$;

revoke execute on function public.record_cloud_sync_usage_event(uuid, uuid, uuid, text, text, text, text, jsonb, timestamptz) from public;
revoke execute on function public.record_cloud_sync_usage_event(uuid, uuid, uuid, text, text, text, text, jsonb, timestamptz) from anon;
revoke execute on function public.record_cloud_sync_usage_event(uuid, uuid, uuid, text, text, text, text, jsonb, timestamptz) from authenticated;
grant execute on function public.record_cloud_sync_usage_event(uuid, uuid, uuid, text, text, text, text, jsonb, timestamptz) to service_role;

revoke execute on function public.open_cloud_sync_usage_session(uuid, uuid, uuid, text, text, timestamptz) from public;
revoke execute on function public.open_cloud_sync_usage_session(uuid, uuid, uuid, text, text, timestamptz) from anon;
revoke execute on function public.open_cloud_sync_usage_session(uuid, uuid, uuid, text, text, timestamptz) from authenticated;
grant execute on function public.open_cloud_sync_usage_session(uuid, uuid, uuid, text, text, timestamptz) to service_role;

revoke execute on function public.touch_cloud_sync_usage_session(uuid, uuid, text, text, timestamptz) from public;
revoke execute on function public.touch_cloud_sync_usage_session(uuid, uuid, text, text, timestamptz) from anon;
revoke execute on function public.touch_cloud_sync_usage_session(uuid, uuid, text, text, timestamptz) from authenticated;
grant execute on function public.touch_cloud_sync_usage_session(uuid, uuid, text, text, timestamptz) to service_role;

revoke execute on function public.close_cloud_sync_usage_session(uuid, timestamptz, text) from public;
revoke execute on function public.close_cloud_sync_usage_session(uuid, timestamptz, text) from anon;
revoke execute on function public.close_cloud_sync_usage_session(uuid, timestamptz, text) from authenticated;
grant execute on function public.close_cloud_sync_usage_session(uuid, timestamptz, text) to service_role;

revoke execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) from public;
revoke execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) from anon;
revoke execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) from authenticated;
grant execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) to service_role;

revoke execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) from public;
revoke execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) from authenticated;
grant execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) to service_role;

revoke execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) from public;
revoke execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) from anon;
revoke execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) from authenticated;
grant execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) to service_role;

revoke execute on function public.revoke_desktop_session_with_leases(uuid, timestamptz) from public;
revoke execute on function public.revoke_desktop_session_with_leases(uuid, timestamptz) from anon;
revoke execute on function public.revoke_desktop_session_with_leases(uuid, timestamptz) from authenticated;
grant execute on function public.revoke_desktop_session_with_leases(uuid, timestamptz) to service_role;

revoke execute on function public.revoke_cloud_sync_lease_with_usage(uuid, timestamptz) from public;
revoke execute on function public.revoke_cloud_sync_lease_with_usage(uuid, timestamptz) from anon;
revoke execute on function public.revoke_cloud_sync_lease_with_usage(uuid, timestamptz) from authenticated;
grant execute on function public.revoke_cloud_sync_lease_with_usage(uuid, timestamptz) to service_role;
