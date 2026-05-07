alter table public.cloud_sync_leases
  add column if not exists released_at timestamptz,
  add column if not exists cooldown_until timestamptz;

create table if not exists public.cloud_sync_settings (
  key text primary key,
  value text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.cloud_sync_settings (key, value)
values ('cloud_sync_device_switch_cooldown_minutes', '180')
on conflict (key) do nothing;

create table if not exists public.cloud_sync_cooldown_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.cloud_sync_settings enable row level security;
alter table public.cloud_sync_cooldown_overrides enable row level security;

drop policy if exists "cloud_sync_settings_admin_all" on public.cloud_sync_settings;
create policy "cloud_sync_settings_admin_all"
  on public.cloud_sync_settings for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cloud_sync_cooldown_overrides_select_own_or_admin" on public.cloud_sync_cooldown_overrides;
create policy "cloud_sync_cooldown_overrides_select_own_or_admin"
  on public.cloud_sync_cooldown_overrides for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cloud_sync_cooldown_overrides_admin_all" on public.cloud_sync_cooldown_overrides;
create policy "cloud_sync_cooldown_overrides_admin_all"
  on public.cloud_sync_cooldown_overrides for all
  using (public.is_admin())
  with check (public.is_admin());

drop function if exists public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz);

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
  update public.desktop_auth_codes
  set used_at = input_now
  where code_hash = input_code_hash
    and state = input_state
    and used_at is null
    and expires_at > input_now
  returning desktop_auth_codes.user_id
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

create or replace function public.get_cloud_sync_cooldown_minutes()
returns integer
language sql
security definer
set search_path = public
as $$
  select greatest(
    0,
    least(
      10080,
      coalesce(
        (
          select nullif(value, '')::integer
          from public.cloud_sync_settings
          where key = 'cloud_sync_device_switch_cooldown_minutes'
        ),
        180
      )
    )
  );
$$;

revoke execute on function public.get_cloud_sync_cooldown_minutes() from public;
revoke execute on function public.get_cloud_sync_cooldown_minutes() from anon;
revoke execute on function public.get_cloud_sync_cooldown_minutes() from authenticated;
grant execute on function public.get_cloud_sync_cooldown_minutes() to service_role;

create or replace function public.has_active_cloud_sync_cooldown_override(
  input_user_id uuid,
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
  order by created_at asc
  limit 1;
$$;

revoke execute on function public.has_active_cloud_sync_cooldown_override(uuid, timestamptz) from public;
revoke execute on function public.has_active_cloud_sync_cooldown_override(uuid, timestamptz) from anon;
revoke execute on function public.has_active_cloud_sync_cooldown_override(uuid, timestamptz) from authenticated;
grant execute on function public.has_active_cloud_sync_cooldown_override(uuid, timestamptz) to service_role;

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
begin
  cooldown_interval := make_interval(mins => public.get_cloud_sync_cooldown_minutes());

  update public.cloud_sync_leases
  set revoked_at = coalesce(revoked_at, expires_at),
      released_at = coalesce(released_at, expires_at),
      cooldown_until = coalesce(cooldown_until, expires_at + cooldown_interval),
      updated_at = input_now
  where user_id = input_user_id
    and revoked_at is null
    and expires_at <= input_now;

  update public.desktop_sessions
  set cloud_sync_active_until = null
  where user_id = input_user_id
    and cloud_sync_active_until is not null
    and cloud_sync_active_until <= input_now;
end;
$$;

revoke execute on function public.mark_cloud_sync_released_leases(uuid, timestamptz) from public;
revoke execute on function public.mark_cloud_sync_released_leases(uuid, timestamptz) from anon;
revoke execute on function public.mark_cloud_sync_released_leases(uuid, timestamptz) from authenticated;
grant execute on function public.mark_cloud_sync_released_leases(uuid, timestamptz) to service_role;

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

  select *
  into session_row
  from public.desktop_sessions
  where id = input_desktop_session_id
    and user_id = input_user_id
    and device_id = input_device_id
    and machine_code_hash = input_machine_code_hash
    and revoked_at is null
    and expires_at > input_now
  for update;

  if not found then
    return query select false, 'invalid_session'::text, null::uuid, null::timestamptz, null::text, null::timestamptz, null::integer, null::uuid;
    return;
  end if;

  perform public.mark_cloud_sync_released_leases(input_user_id, input_now);

  select *
  into active_lease
  from public.cloud_sync_leases
  where user_id = input_user_id
    and revoked_at is null
  order by created_at desc
  limit 1;

  if found and active_lease.desktop_session_id <> input_desktop_session_id then
    return query select false, 'active_on_another_device'::text, null::uuid, null::timestamptz, active_lease.device_id, null::timestamptz, null::integer, null::uuid;
    return;
  end if;

  active_override_id := public.has_active_cloud_sync_cooldown_override(input_user_id, input_now);

  if active_override_id is null then
    select *
    into cooldown_lease
    from public.cloud_sync_leases
    where user_id = input_user_id
      and revoked_at is not null
      and cooldown_until is not null
      and cooldown_until > input_now
      and desktop_session_id <> input_desktop_session_id
    order by cooldown_until desc
    limit 1;

    if found then
      return query select false, 'cooldown_waiting'::text, null::uuid, null::timestamptz, cooldown_lease.device_id, cooldown_lease.cooldown_until, ceil(extract(epoch from (cooldown_lease.cooldown_until - input_now)))::integer, null::uuid;
      return;
    end if;
  end if;

  if active_lease.id is not null and active_lease.desktop_session_id = input_desktop_session_id then
    update public.cloud_sync_leases
    set last_heartbeat_at = input_now,
        expires_at = input_expires_at,
        updated_at = input_now
    where id = active_lease.id
    returning *
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
    update public.cloud_sync_cooldown_overrides
    set consumed_at = input_now
    where id = active_override_id;
  end if;

  update public.desktop_sessions
  set cloud_sync_active_until = input_expires_at,
      last_seen_at = input_now
  where id = input_desktop_session_id
    and user_id = input_user_id;

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

  select *
  into session_row
  from public.desktop_sessions
  where id = input_desktop_session_id
    and user_id = input_user_id
    and revoked_at is null
    and expires_at > input_now
  for update;

  if not found then
    return query select false, 'invalid_session'::text, null::uuid, null::timestamptz, null::text;
    return;
  end if;

  perform public.mark_cloud_sync_released_leases(input_user_id, input_now);

  select *
  into active_lease
  from public.cloud_sync_leases
  where user_id = input_user_id
    and revoked_at is null
  order by created_at desc
  limit 1;

  if not found then
    return query select false, 'lease_not_found'::text, null::uuid, null::timestamptz, null::text;
    return;
  end if;

  if active_lease.desktop_session_id <> input_desktop_session_id then
    return query select false, 'active_on_another_device'::text, null::uuid, null::timestamptz, active_lease.device_id;
    return;
  end if;

  update public.cloud_sync_leases
  set last_heartbeat_at = input_now,
      expires_at = input_expires_at,
      updated_at = input_now
  where id = active_lease.id
  returning *
  into active_lease;

  update public.desktop_sessions
  set cloud_sync_active_until = input_expires_at,
      last_seen_at = input_now
  where id = input_desktop_session_id
    and user_id = input_user_id;

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

  select *
  into active_lease
  from public.cloud_sync_leases
  where user_id = input_user_id
    and revoked_at is null
  order by created_at desc
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

  update public.cloud_sync_leases
  set revoked_at = input_now,
      released_at = coalesce(released_at, input_now),
      cooldown_until = coalesce(cooldown_until, input_now + make_interval(mins => public.get_cloud_sync_cooldown_minutes())),
      updated_at = input_now
  where user_id = input_user_id
    and desktop_session_id = input_desktop_session_id
    and revoked_at is null;

  update public.desktop_sessions
  set cloud_sync_active_until = null,
      last_seen_at = input_now
  where id = input_desktop_session_id
    and user_id = input_user_id;

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

  update public.cloud_sync_leases
  set revoked_at = input_now,
      released_at = coalesce(released_at, input_now),
      cooldown_until = coalesce(cooldown_until, input_now + make_interval(mins => public.get_cloud_sync_cooldown_minutes())),
      updated_at = input_now
  where desktop_session_id = input_desktop_session_id
    and revoked_at is null;

  return true;
end;
$$;
