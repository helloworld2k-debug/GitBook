create table public.license_code_redeem_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  ip_address text,
  code_hash text,
  result text not null check (result in ('success', 'failure', 'blocked')),
  reason text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.license_code_redeem_blocks (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('user', 'ip')),
  scope_value text not null,
  reason text not null,
  blocked_until timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  check (blocked_until > created_at)
);

create table public.registration_attempts (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  email_domain text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index license_code_redeem_attempts_user_idx on public.license_code_redeem_attempts (user_id, created_at desc);
create index license_code_redeem_attempts_ip_idx on public.license_code_redeem_attempts (ip_address, created_at desc) where ip_address is not null;
create index license_code_redeem_attempts_code_idx on public.license_code_redeem_attempts (code_hash, created_at desc) where code_hash is not null;
create index license_code_redeem_blocks_scope_idx on public.license_code_redeem_blocks (scope, scope_value, blocked_until desc);
create index registration_attempts_email_idx on public.registration_attempts (email_normalized, created_at desc);
create index registration_attempts_ip_idx on public.registration_attempts (ip_address, created_at desc) where ip_address is not null;
create index registration_attempts_domain_idx on public.registration_attempts (email_domain, created_at desc);

alter table public.license_code_redeem_attempts enable row level security;
alter table public.license_code_redeem_blocks enable row level security;
alter table public.registration_attempts enable row level security;

create policy "license_code_redeem_attempts_admin_all"
  on public.license_code_redeem_attempts for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "license_code_redeem_blocks_admin_all"
  on public.license_code_redeem_blocks for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "registration_attempts_admin_all"
  on public.registration_attempts for all
  using (public.is_admin())
  with check (public.is_admin());
