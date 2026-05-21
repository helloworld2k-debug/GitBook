-- User login history tracking
create table if not exists public.user_login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ip_address inet,
  user_agent text,
  success boolean not null default true,
  failure_reason text,
  login_method text, -- 'email', 'oauth', 'magic_link', etc.
  logged_in_at timestamptz default now()
);

-- Create indexes for efficient querying
create index if not exists user_login_history_user_id_idx on public.user_login_history(user_id, logged_in_at desc);
create index if not exists user_login_history_logged_in_at_idx on public.user_login_history(logged_in_at desc);
create index if not exists user_login_history_success_idx on public.user_login_history(success, logged_in_at desc);

-- Enable RLS
alter table public.user_login_history enable row level security;

-- Policies (service_role full access for admin viewing)
create policy "Service role full access on login history"
on public.user_login_history for all
to service_role
using (true)
with check (true);

-- Users can view their own login history
create policy "Users can view own login history"
on public.user_login_history for select
to authenticated
using (user_id = auth.uid());

-- Function to record login (called from auth hooks or API)
create or replace function public.record_user_login(
  p_user_id uuid,
  p_ip_address inet default null,
  p_user_agent text default null,
  p_success boolean default true,
  p_failure_reason text default null,
  p_login_method text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_history_id uuid;
begin
  insert into public.user_login_history (
    user_id,
    ip_address,
    user_agent,
    success,
    failure_reason,
    login_method,
    logged_in_at
  ) values (
    p_user_id,
    p_ip_address,
    p_user_agent,
    p_success,
    p_failure_reason,
    p_login_method,
    now()
  ) returning id into v_history_id;

  return v_history_id;
end;
$$;

revoke all on function public.record_user_login from public;
grant execute on function public.record_user_login to service_role;
-- Allow authenticated users to record their own successful logins
grant execute on function public.record_user_login to authenticated;
