create table if not exists public.support_feedback_messages (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.support_feedback(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  admin_user_id uuid references public.profiles(id) on delete set null,
  author_role text not null check (author_role in ('user', 'admin')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  check (
    (author_role = 'user' and user_id is not null and admin_user_id is null)
    or (author_role = 'admin' and admin_user_id is not null and user_id is null)
  )
);

create index if not exists support_feedback_messages_feedback_created_idx
on public.support_feedback_messages (feedback_id, created_at);

alter table public.support_feedback_messages enable row level security;

create policy "support_feedback_messages_admin_all"
  on public.support_feedback_messages for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "support_feedback_messages_own_read"
  on public.support_feedback_messages for select
  using (
    exists (
      select 1
      from public.support_feedback
      where support_feedback.id = support_feedback_messages.feedback_id
        and support_feedback.user_id = auth.uid()
    )
  );

create policy "support_feedback_messages_own_insert"
  on public.support_feedback_messages for insert
  with check (
    author_role = 'user'
    and user_id = auth.uid()
    and exists (
      select 1
      from public.support_feedback
      where support_feedback.id = support_feedback_messages.feedback_id
        and support_feedback.user_id = auth.uid()
    )
  );

drop policy if exists "support_feedback_own_insert" on public.support_feedback;

create policy "support_feedback_own_insert"
  on public.support_feedback for insert
  with check (user_id = auth.uid());

alter table public.trial_codes
  alter column starts_at drop not null,
  alter column ends_at drop not null,
  drop constraint if exists trial_codes_check;

alter table public.trial_codes
  add constraint trial_codes_window_check
  check (starts_at is null or ends_at is null or ends_at > starts_at);

create or replace function public.redeem_trial_code(
  input_user_id uuid,
  input_code_hash text,
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
  perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0));

  if not trial.is_active or trial.deleted_at is not null then
    return query select false, 'trial_code_inactive'::text, null::timestamptz;
    return;
  end if;

  if trial.max_redemptions is not null and trial.redemption_count >= trial.max_redemptions then
    return query select false, 'trial_code_limit_reached'::text, null::timestamptz;
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
    null,
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

revoke execute on function public.redeem_trial_code(uuid, text, timestamptz) from public;
revoke execute on function public.redeem_trial_code(uuid, text, timestamptz) from anon;
revoke execute on function public.redeem_trial_code(uuid, text, timestamptz) from authenticated;
grant execute on function public.redeem_trial_code(uuid, text, timestamptz) to service_role;
