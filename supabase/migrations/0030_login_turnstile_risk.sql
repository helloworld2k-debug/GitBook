create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  email_domain text not null,
  ip_address text,
  result text not null check (result in ('success', 'failure')),
  user_agent text,
  created_at timestamptz not null default now()
);

create index login_attempts_email_result_idx
on public.login_attempts (email_normalized, result, created_at desc);

create index login_attempts_ip_result_idx
on public.login_attempts (ip_address, result, created_at desc)
where ip_address is not null;

create index login_attempts_email_ip_result_idx
on public.login_attempts (email_normalized, ip_address, result, created_at desc)
where ip_address is not null;

alter table public.login_attempts enable row level security;

create policy "login_attempts_admin_all"
  on public.login_attempts for all
  using (public.is_admin())
  with check (public.is_admin());
