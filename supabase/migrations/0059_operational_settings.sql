create table if not exists public.operational_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.operational_settings (key, value)
values (
  'payment_checkout',
  '{"is_paused": false, "message": "Checkout is temporarily paused while we investigate a payment issue. Existing payments will continue to be processed."}'::jsonb
)
on conflict (key) do nothing;

alter table public.operational_settings enable row level security;

drop policy if exists "Public reads payment checkout operational setting" on public.operational_settings;
create policy "Public reads payment checkout operational setting"
  on public.operational_settings
  for select
  using (key = 'payment_checkout');

drop policy if exists "Service role manages operational settings" on public.operational_settings;
create policy "Service role manages operational settings"
  on public.operational_settings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
