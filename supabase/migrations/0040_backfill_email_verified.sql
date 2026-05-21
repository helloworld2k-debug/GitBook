-- Backfill email_verified for users whose email was confirmed in Supabase Auth
-- (either by clicking the verification link or by admin API auto-confirmation)
-- but whose profiles.email_verified was never updated.
update public.profiles p
set email_verified = true
from auth.users u
where p.id = u.id
  and p.email_verified = false
  and u.email_confirmed_at is not null;
