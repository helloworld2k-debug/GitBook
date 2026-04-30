create type license_feature_code as enum ('cloud_sync');
create type license_entitlement_status as enum ('active', 'expired', 'revoked');

create table public.license_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_code license_feature_code not null default 'cloud_sync',
  valid_until timestamptz not null,
  status license_entitlement_status not null default 'active',
  source_donation_id uuid references public.donations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_code)
);

create table public.license_entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_code license_feature_code not null default 'cloud_sync',
  source_donation_id uuid not null references public.donations(id) on delete cascade,
  granted_days integer not null check (granted_days > 0),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (source_donation_id, feature_code)
);

create table public.trial_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  label text not null,
  feature_code license_feature_code not null default 'cloud_sync',
  trial_days integer not null default 3 check (trial_days > 0 and trial_days <= 365),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.trial_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  trial_code_id uuid not null references public.trial_codes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  machine_code_hash text not null,
  feature_code license_feature_code not null default 'cloud_sync',
  redeemed_at timestamptz not null default now(),
  trial_valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (trial_code_id, user_id, feature_code)
);

create table public.machine_trial_claims (
  id uuid primary key default gen_random_uuid(),
  machine_code_hash text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trial_code_id uuid references public.trial_codes(id) on delete set null,
  feature_code license_feature_code not null default 'cloud_sync',
  trial_started_at timestamptz not null default now(),
  trial_valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (machine_code_hash, feature_code)
);

create table public.desktop_auth_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_session_id text not null,
  return_url text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.desktop_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  machine_code_hash text not null,
  platform text not null,
  device_name text,
  app_version text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create table public.desktop_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  device_id text not null,
  machine_code_hash text not null,
  platform text not null,
  app_version text,
  last_seen_at timestamptz not null default now(),
  cloud_sync_active_until timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cloud_sync_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  desktop_session_id uuid not null references public.desktop_sessions(id) on delete cascade,
  device_id text not null,
  machine_code_hash text not null,
  lease_started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active cloud sync lease is allowed per user. Activation code revokes
-- existing non-revoked leases before inserting a replacement; expires_at is
-- checked and handled by the lease service instead of this partial predicate.
create unique index cloud_sync_leases_one_active_per_user
on public.cloud_sync_leases (user_id)
where revoked_at is null;

create index license_entitlements_user_feature_idx on public.license_entitlements (user_id, feature_code);
create index license_entitlement_grants_user_feature_idx on public.license_entitlement_grants (user_id, feature_code);
create index license_entitlement_grants_donation_idx on public.license_entitlement_grants (source_donation_id);
create index machine_trial_claims_user_idx on public.machine_trial_claims (user_id);
create index trial_code_redemptions_user_idx on public.trial_code_redemptions (user_id);
create index desktop_sessions_user_idx on public.desktop_sessions (user_id);
create index desktop_devices_machine_idx on public.desktop_devices (machine_code_hash);
create index cloud_sync_leases_session_idx on public.cloud_sync_leases (desktop_session_id);

alter table public.license_entitlements enable row level security;
alter table public.license_entitlement_grants enable row level security;
alter table public.trial_codes enable row level security;
alter table public.trial_code_redemptions enable row level security;
alter table public.machine_trial_claims enable row level security;
alter table public.desktop_auth_codes enable row level security;
alter table public.desktop_devices enable row level security;
alter table public.desktop_sessions enable row level security;
alter table public.cloud_sync_leases enable row level security;

create policy "license_entitlements_select_own_or_admin"
  on public.license_entitlements for select
  using (user_id = auth.uid() or public.is_admin());

create policy "license_entitlement_grants_select_own_or_admin"
  on public.license_entitlement_grants for select
  using (user_id = auth.uid() or public.is_admin());

create policy "trial_codes_admin_all"
  on public.trial_codes for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "trial_redemptions_select_own_or_admin"
  on public.trial_code_redemptions for select
  using (user_id = auth.uid() or public.is_admin());

create policy "machine_trial_claims_select_own_or_admin"
  on public.machine_trial_claims for select
  using (user_id = auth.uid() or public.is_admin());

create policy "desktop_auth_codes_select_own_or_admin"
  on public.desktop_auth_codes for select
  using (user_id = auth.uid() or public.is_admin());

create policy "desktop_devices_select_own_or_admin"
  on public.desktop_devices for select
  using (user_id = auth.uid() or public.is_admin());

create policy "desktop_sessions_select_own_or_admin"
  on public.desktop_sessions for select
  using (user_id = auth.uid() or public.is_admin());

create policy "cloud_sync_leases_select_own_or_admin"
  on public.cloud_sync_leases for select
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.grant_cloud_sync_entitlement_for_donation(
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

revoke execute on function public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz) from public;
revoke execute on function public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz) from anon;
revoke execute on function public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz) from authenticated;
grant execute on function public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz) to service_role;

create or replace function public.redeem_trial_code(
  input_user_id uuid,
  input_code_hash text,
  input_machine_code_hash text,
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
  perform pg_advisory_xact_lock(hashtextextended(input_machine_code_hash, 0));

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
    from public.machine_trial_claims
    where machine_code_hash = input_machine_code_hash
      and feature_code = 'cloud_sync'
  ) then
    return query select false, 'machine_trial_used'::text, null::timestamptz;
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
    input_user_id,
    trial.id,
    'cloud_sync',
    input_now,
    trial_valid_until
  );

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
    input_machine_code_hash,
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

revoke execute on function public.redeem_trial_code(uuid, text, text, timestamptz) from public;
revoke execute on function public.redeem_trial_code(uuid, text, text, timestamptz) from anon;
revoke execute on function public.redeem_trial_code(uuid, text, text, timestamptz) from authenticated;
grant execute on function public.redeem_trial_code(uuid, text, text, timestamptz) to service_role;

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
language sql
security definer
set search_path = public
as $$
  with claimed as (
    update public.desktop_auth_codes
    set used_at = input_now
    where code_hash = input_code_hash
      and used_at is null
      and expires_at > input_now
    returning desktop_auth_codes.user_id
  ),
  upserted_device as (
    insert into public.desktop_devices (
      user_id,
      device_id,
      machine_code_hash,
      platform,
      app_version,
      device_name,
      last_seen_at
    )
    select
      claimed.user_id,
      input_device_id,
      input_machine_code_hash,
      input_platform,
      input_app_version,
      input_device_name,
      input_now
    from claimed
    on conflict (user_id, device_id)
    do update set
      machine_code_hash = excluded.machine_code_hash,
      platform = excluded.platform,
      app_version = excluded.app_version,
      device_name = excluded.device_name,
      last_seen_at = excluded.last_seen_at
    returning desktop_devices.user_id
  ),
  inserted_session as (
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
    select
      claimed.user_id,
      input_token_hash,
      input_device_id,
      input_machine_code_hash,
      input_platform,
      input_app_version,
      input_now,
      input_session_expires_at
    from claimed
    returning desktop_sessions.user_id, desktop_sessions.id
  )
  select inserted_session.user_id, inserted_session.id
  from inserted_session
  join upserted_device on upserted_device.user_id = inserted_session.user_id;
$$;

revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz) from public;
revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz) from anon;
revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz) from authenticated;
grant execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz) to service_role;

create or replace function public.activate_cloud_sync_lease(
  input_user_id uuid,
  input_desktop_session_id uuid,
  input_device_id text,
  input_machine_code_hash text,
  input_expires_at timestamptz,
  input_now timestamptz
)
returns table(ok boolean, reason text, lease_id uuid, expires_at timestamptz, active_device_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_lease public.cloud_sync_leases%rowtype;
  session_row public.desktop_sessions%rowtype;
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
    return query select false, 'invalid_session'::text, null::uuid, null::timestamptz, null::text;
    return;
  end if;

  update public.cloud_sync_leases
  set revoked_at = input_now,
      updated_at = input_now
  where user_id = input_user_id
    and revoked_at is null;

  update public.desktop_sessions
  set cloud_sync_active_until = null
  where user_id = input_user_id
    and cloud_sync_active_until is not null;

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

  update public.desktop_sessions
  set cloud_sync_active_until = input_expires_at,
      last_seen_at = input_now
  where id = input_desktop_session_id
    and user_id = input_user_id;

  return query select true, 'active'::text, inserted_lease.id, inserted_lease.expires_at, inserted_lease.device_id;
end;
$$;

revoke execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) from public;
revoke execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) from anon;
revoke execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) from authenticated;
grant execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) to service_role;

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

  update public.cloud_sync_leases
  set revoked_at = input_now,
      updated_at = input_now
  where user_id = input_user_id
    and revoked_at is null
    and expires_at <= input_now;

  update public.desktop_sessions
  set cloud_sync_active_until = null
  where user_id = input_user_id
    and cloud_sync_active_until is not null
    and cloud_sync_active_until <= input_now;

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

revoke execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) from public;
revoke execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) from authenticated;
grant execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) to service_role;

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

  update public.cloud_sync_leases
  set revoked_at = input_now,
      updated_at = input_now
  where user_id = input_user_id
    and revoked_at is null
    and expires_at <= input_now;

  update public.desktop_sessions
  set cloud_sync_active_until = null
  where user_id = input_user_id
    and cloud_sync_active_until is not null
    and cloud_sync_active_until <= input_now;

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

revoke execute on function public.read_cloud_sync_lease_status(uuid, uuid, timestamptz) from public;
revoke execute on function public.read_cloud_sync_lease_status(uuid, uuid, timestamptz) from anon;
revoke execute on function public.read_cloud_sync_lease_status(uuid, uuid, timestamptz) from authenticated;
grant execute on function public.read_cloud_sync_lease_status(uuid, uuid, timestamptz) to service_role;

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

revoke execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) from public;
revoke execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) from anon;
revoke execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) from authenticated;
grant execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) to service_role;

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
      updated_at = input_now
  where desktop_session_id = input_desktop_session_id
    and revoked_at is null;

  return true;
end;
$$;

revoke execute on function public.revoke_desktop_session_with_leases(uuid, timestamptz) from public;
revoke execute on function public.revoke_desktop_session_with_leases(uuid, timestamptz) from anon;
revoke execute on function public.revoke_desktop_session_with_leases(uuid, timestamptz) from authenticated;
grant execute on function public.revoke_desktop_session_with_leases(uuid, timestamptz) to service_role;
