create type license_code_channel_type as enum ('internal', 'taobao', 'xianyu', 'partner', 'other');

create table public.license_code_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  channel_type license_code_channel_type not null default 'internal',
  channel_note text,
  duration_kind license_code_duration_kind not null,
  trial_days integer not null check (trial_days > 0 and trial_days <= 365),
  code_count integer not null check (code_count >= 1 and code_count <= 10),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.trial_codes
  add column if not exists channel_type license_code_channel_type not null default 'internal',
  add column if not exists channel_note text;

update public.trial_codes
set batch_id = null,
    updated_at = now()
where batch_id is not null
  and not exists (
    select 1
    from public.license_code_batches batch
    where batch.id = trial_codes.batch_id
  );

alter table public.trial_codes
  drop constraint if exists trial_codes_batch_id_fkey,
  add constraint trial_codes_batch_id_fkey
    foreign key (batch_id) references public.license_code_batches(id) on delete set null;

create index license_code_batches_created_idx on public.license_code_batches (created_at desc);
create index license_code_batches_channel_idx on public.license_code_batches (channel_type, created_at desc);
create index trial_codes_channel_idx on public.trial_codes (channel_type, created_at desc);
create index trial_code_redemptions_machine_trial_idx on public.trial_code_redemptions (machine_code_hash, feature_code)
  where machine_code_hash is not null;

alter table public.license_code_batches enable row level security;

create policy "license_code_batches_admin_all"
  on public.license_code_batches for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.redeem_license_code(
  input_user_id uuid,
  input_code_hash text,
  input_machine_code_hash text default null,
  input_now timestamptz default now()
)
returns table(ok boolean, reason text, valid_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  code public.trial_codes%rowtype;
  current_valid_until timestamptz;
  grant_valid_from timestamptz;
  grant_valid_until timestamptz;
  grant_days integer;
begin
  select *
  into code
  from public.trial_codes
  where code_hash = input_code_hash
  for update;

  if not found then
    return query select false, 'trial_code_invalid'::text, null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(code.id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0));

  if not code.is_active or code.deleted_at is not null then
    return query select false, 'trial_code_inactive'::text, null::timestamptz;
    return;
  end if;

  if code.max_redemptions is not null and code.redemption_count >= code.max_redemptions then
    return query select false, 'trial_code_limit_reached'::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1
    from public.trial_code_redemptions
    where trial_code_id = code.id
      and user_id = input_user_id
      and feature_code = code.feature_code
  ) then
    return query select false, 'duplicate_trial_code_user'::text, null::timestamptz;
    return;
  end if;

  if code.duration_kind = 'trial_3_day' then
    if code.trial_days < 1 or code.trial_days > 7 then
      return query select false, 'trial_code_inactive'::text, null::timestamptz;
      return;
    end if;

    if exists (
      select 1
      from public.trial_code_redemptions redemption
      join public.trial_codes redeemed_code on redeemed_code.id = redemption.trial_code_id
      where redemption.user_id = input_user_id
        and redemption.feature_code = code.feature_code
        and redeemed_code.duration_kind = 'trial_3_day'
    ) then
      return query select false, 'duplicate_trial_code_user'::text, null::timestamptz;
      return;
    end if;

    if input_machine_code_hash is not null and exists (
      select 1
      from public.trial_code_redemptions redemption
      join public.trial_codes redeemed_code on redeemed_code.id = redemption.trial_code_id
      where redemption.machine_code_hash = input_machine_code_hash
        and redemption.feature_code = code.feature_code
        and redeemed_code.duration_kind = 'trial_3_day'
    ) then
      return query select false, 'duplicate_trial_code_machine'::text, null::timestamptz;
      return;
    end if;

    grant_days := code.trial_days;
    grant_valid_until := input_now + make_interval(days => grant_days);
  else
    grant_days := case code.duration_kind
      when 'month_1' then 30
      when 'month_3' then 90
      when 'year_1' then 365
      else null
    end;

    if grant_days is null then
      return query select false, 'trial_code_inactive'::text, null::timestamptz;
      return;
    end if;

    select valid_until
    into current_valid_until
    from public.license_entitlements
    where user_id = input_user_id
      and feature_code = code.feature_code
      and status = 'active';

    if current_valid_until is not null and current_valid_until > input_now then
      grant_valid_from := current_valid_until;
    else
      grant_valid_from := input_now;
    end if;

    grant_valid_until := grant_valid_from + make_interval(days => grant_days);

    insert into public.license_entitlements (
      user_id,
      feature_code,
      valid_until,
      status,
      source_donation_id
    )
    values (
      input_user_id,
      code.feature_code,
      grant_valid_until,
      'active',
      null
    )
    on conflict (user_id, feature_code)
    do update set
      valid_until = excluded.valid_until,
      status = 'active',
      updated_at = input_now;
  end if;

  insert into public.trial_code_redemptions (
    trial_code_id,
    user_id,
    machine_code_hash,
    feature_code,
    redeemed_at,
    trial_valid_until
  )
  values (
    code.id,
    input_user_id,
    input_machine_code_hash,
    code.feature_code,
    input_now,
    grant_valid_until
  );

  update public.trial_codes
  set redemption_count = redemption_count + 1,
      updated_at = input_now
  where id = code.id;

  return query select true, 'redeemed'::text, grant_valid_until;
end;
$$;

create or replace function public.redeem_trial_code(
  input_user_id uuid,
  input_code_hash text,
  input_now timestamptz
)
returns table(ok boolean, reason text, valid_until timestamptz)
language sql
security definer
set search_path = public
as $$
  select * from public.redeem_license_code(input_user_id, input_code_hash, null, input_now);
$$;

revoke execute on function public.redeem_license_code(uuid, text, text, timestamptz) from public;
revoke execute on function public.redeem_license_code(uuid, text, text, timestamptz) from anon;
revoke execute on function public.redeem_license_code(uuid, text, text, timestamptz) from authenticated;
grant execute on function public.redeem_license_code(uuid, text, text, timestamptz) to service_role;
