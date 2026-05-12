create table public.registration_blocks (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('ip', 'email', 'domain')),
  scope_value text not null check (length(scope_value) between 1 and 320),
  reason text not null check (char_length(reason) between 1 and 500),
  blocked_until timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_reason text check (revoked_reason is null or char_length(revoked_reason) between 1 and 500),
  check (blocked_until > created_at)
);

create index registration_blocks_scope_idx
on public.registration_blocks (scope, scope_value, blocked_until desc)
where revoked_at is null;

create index registration_blocks_created_idx
on public.registration_blocks (created_at desc);

alter table public.registration_blocks enable row level security;

create policy "registration_blocks_admin_all"
  on public.registration_blocks for all
  using (public.is_admin())
  with check (public.is_admin());
