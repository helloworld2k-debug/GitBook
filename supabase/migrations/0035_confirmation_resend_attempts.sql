create table public.confirmation_resend_attempts (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  email_domain text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index confirmation_resend_attempts_email_idx
on public.confirmation_resend_attempts (email_normalized, created_at desc);

create index confirmation_resend_attempts_ip_idx
on public.confirmation_resend_attempts (ip_address, created_at desc)
where ip_address is not null;

create index confirmation_resend_attempts_domain_idx
on public.confirmation_resend_attempts (email_domain, created_at desc);

alter table public.confirmation_resend_attempts enable row level security;

create policy "confirmation_resend_attempts_admin_all"
  on public.confirmation_resend_attempts for all
  using (public.is_admin())
  with check (public.is_admin());
