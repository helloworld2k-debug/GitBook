create table if not exists public.support_feedback_admin_reads (
  feedback_id uuid not null references public.support_feedback(id) on delete cascade,
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (feedback_id, admin_user_id)
);

create index if not exists support_feedback_admin_reads_admin_idx
on public.support_feedback_admin_reads (admin_user_id, read_at desc);

alter table public.support_feedback_admin_reads enable row level security;

drop policy if exists "support_feedback_admin_reads_admin_all" on public.support_feedback_admin_reads;

create policy "support_feedback_admin_reads_admin_all"
  on public.support_feedback_admin_reads for all
  using (public.is_admin())
  with check (public.is_admin());
