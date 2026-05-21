alter table public.profiles
  add column if not exists email_verified boolean not null default false;

-- Existing users all went through Supabase's email confirmation flow.
update public.profiles
set email_verified = true
where email_verified = false;
