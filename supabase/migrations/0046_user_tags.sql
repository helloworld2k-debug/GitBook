-- User tags system for grouping and categorizing users
create table if not exists public.user_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#3b82f6',
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index on name for faster lookups
create index if not exists user_tags_name_idx on public.user_tags(name);

-- User tag assignments (many-to-many relationship)
create table if not exists public.user_tag_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tag_id uuid not null references public.user_tags(id) on delete cascade,
  assigned_at timestamptz default now(),
  assigned_by uuid references public.profiles(id) on delete set null,
  primary key (user_id, tag_id)
);

-- Create indexes for faster queries
create index if not exists user_tag_assignments_user_id_idx on public.user_tag_assignments(user_id);
create index if not exists user_tag_assignments_tag_id_idx on public.user_tag_assignments(tag_id);

-- Enable RLS
alter table public.user_tags enable row level security;
alter table public.user_tag_assignments enable row level security;

-- Policies for user_tags (service_role full access)
create policy "Service role full access on user_tags"
on public.user_tags for all
to service_role
using (true)
with check (true);

-- Policies for user_tag_assignments (service_role full access)
create policy "Service role full access on user_tag_assignments"
on public.user_tag_assignments for all
to service_role
using (true)
with check (true);
