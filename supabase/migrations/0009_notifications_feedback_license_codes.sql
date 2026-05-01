create type notification_audience as enum ('all', 'authenticated', 'admins');
create type notification_priority as enum ('info', 'success', 'warning', 'critical');
create type support_feedback_status as enum ('open', 'reviewing', 'closed');
create type license_code_duration_kind as enum ('trial_3_day', 'month_1', 'month_3', 'year_1');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  locale text check (locale in ('en', 'zh-Hant', 'ja', 'ko')),
  audience notification_audience not null default 'all',
  priority notification_priority not null default 'info',
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or published_at is null or expires_at > published_at)
);

create table public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table public.support_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  contact text,
  category text not null default 'account',
  subject text not null check (char_length(subject) between 1 and 180),
  message text not null check (char_length(message) between 1 and 4000),
  status support_feedback_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.trial_codes
  add column if not exists duration_kind license_code_duration_kind not null default 'trial_3_day',
  add column if not exists code_mask text,
  add column if not exists encrypted_code_ciphertext text,
  add column if not exists encrypted_code_iv text,
  add column if not exists encrypted_code_tag text,
  add column if not exists encrypted_code_algorithm text not null default 'aes-256-gcm',
  add column if not exists batch_id uuid,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create index notifications_published_idx on public.notifications (published_at, expires_at);
create index support_feedback_status_created_idx on public.support_feedback (status, created_at desc);
create index trial_codes_batch_idx on public.trial_codes (batch_id);
create index trial_codes_duration_idx on public.trial_codes (duration_kind, created_at desc);

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.support_feedback enable row level security;

create policy "notifications_public_read"
  on public.notifications for select
  using (
    published_at is not null
    and published_at <= now()
    and (expires_at is null or expires_at > now())
    and audience = 'all'
  );

create policy "notifications_authenticated_read"
  on public.notifications for select
  using (
    public.is_admin()
    or (
      auth.uid() is not null
      and published_at is not null
      and published_at <= now()
      and (expires_at is null or expires_at > now())
      and audience in ('all', 'authenticated')
    )
  );

create policy "notifications_admin_all"
  on public.notifications for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "notification_reads_own"
  on public.notification_reads for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "support_feedback_admin_read"
  on public.support_feedback for select
  using (public.is_admin());

create policy "support_feedback_admin_update"
  on public.support_feedback for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "support_feedback_own_read"
  on public.support_feedback for select
  using (user_id = auth.uid());

drop policy if exists "trial_codes_admin_all" on public.trial_codes;

create policy "trial_codes_admin_all"
  on public.trial_codes for all
  using (public.is_admin() and deleted_at is null)
  with check (public.is_admin());
