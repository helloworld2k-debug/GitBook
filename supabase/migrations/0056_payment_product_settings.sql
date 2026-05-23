create table if not exists public.payment_product_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'dodo',
  environment text not null,
  tier_code text not null,
  product_id text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint payment_product_settings_provider_check check (provider in ('dodo')),
  constraint payment_product_settings_environment_check check (environment in ('test', 'live')),
  constraint payment_product_settings_tier_code_check check (tier_code in ('monthly', 'quarterly', 'yearly')),
  constraint payment_product_settings_product_id_check check (product_id ~ '^pdt_[A-Za-z0-9]+$'),
  unique (provider, environment, tier_code)
);

alter table public.payment_product_settings enable row level security;

drop policy if exists "Service role manages payment product settings" on public.payment_product_settings;
create policy "Service role manages payment product settings"
  on public.payment_product_settings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
