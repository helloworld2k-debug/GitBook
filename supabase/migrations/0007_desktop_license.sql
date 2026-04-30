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

create unique index cloud_sync_leases_one_active_per_user
on public.cloud_sync_leases (user_id)
where revoked_at is null;

create index license_entitlements_user_feature_idx on public.license_entitlements (user_id, feature_code);
create index machine_trial_claims_user_idx on public.machine_trial_claims (user_id);
create index trial_code_redemptions_user_idx on public.trial_code_redemptions (user_id);
create index desktop_sessions_token_hash_idx on public.desktop_sessions (token_hash);
create index desktop_sessions_user_idx on public.desktop_sessions (user_id);
create index desktop_devices_machine_idx on public.desktop_devices (machine_code_hash);
create index cloud_sync_leases_session_idx on public.cloud_sync_leases (desktop_session_id);

alter table public.license_entitlements enable row level security;
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
