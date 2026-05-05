create table if not exists public.support_contact_channels (
  id text primary key
    check (id in ('telegram', 'discord', 'qq', 'email', 'wechat')),
  label text not null,
  value text not null default '',
  is_enabled boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.support_contact_channels enable row level security;

create policy "support_contact_channels_public_read" on public.support_contact_channels
for select using (true);

create policy "support_contact_channels_admin_write" on public.support_contact_channels
for all using (public.is_admin())
with check (public.is_admin());

insert into public.support_contact_channels (id, label, value, is_enabled, sort_order)
values
  ('telegram', 'Telegram', '', false, 10),
  ('discord', 'Discord', '', false, 20),
  ('qq', 'QQ', '', false, 30),
  ('email', 'Email', '', false, 40),
  ('wechat', 'WeChat', '', false, 50)
on conflict (id) do nothing;
