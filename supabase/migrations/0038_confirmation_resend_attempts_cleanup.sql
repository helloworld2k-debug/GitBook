create or replace function public.cleanup_confirmation_resend_attempts(
  input_retention_days integer default 7
)
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.confirmation_resend_attempts
    where created_at < now() - make_interval(days => input_retention_days)
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke execute on function public.cleanup_confirmation_resend_attempts(integer) from public;
revoke execute on function public.cleanup_confirmation_resend_attempts(integer) from anon;
revoke execute on function public.cleanup_confirmation_resend_attempts(integer) from authenticated;
grant execute on function public.cleanup_confirmation_resend_attempts(integer) to service_role;
