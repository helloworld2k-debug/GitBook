create type donation_provider as enum ('stripe', 'paypal', 'manual', 'dodo');
create type donation_status as enum ('pending', 'paid', 'cancelled', 'failed', 'refunded');
create type certificate_type as enum ('donation', 'honor');
create type certificate_status as enum ('active', 'revoked', 'generation_failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'zh-Hant', 'ja', 'ko')),
  public_supporter_enabled boolean not null default false,
  public_display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_locale text;
begin
  requested_locale := new.raw_user_meta_data->>'preferred_locale';

  insert into public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    preferred_locale,
    public_display_name,
    is_admin
  )
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data->>'email', ''),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url',
    case
      when requested_locale in ('en', 'zh-Hant', 'ja', 'ko') then requested_locale
      else 'en'
    end,
    coalesce(
      new.raw_user_meta_data->>'public_display_name',
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    false
  );

  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create table public.donation_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text not null,
  amount integer not null check (amount > 0),
  compare_at_amount integer check (compare_at_amount is null or compare_at_amount > amount),
  currency text not null default 'usd',
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sponsor_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  minimum_total_amount integer not null check (minimum_total_amount >= 0),
  currency text not null default 'usd',
  sort_order integer not null,
  is_active boolean not null default true
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier_id uuid references public.donation_tiers(id),
  amount integer not null check (amount > 0),
  currency text not null default 'usd',
  provider donation_provider not null,
  provider_transaction_id text not null,
  status donation_status not null default 'pending',
  paid_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_transaction_id)
);

create sequence public.donation_certificate_seq;
create sequence public.honor_certificate_seq;

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  donation_id uuid references public.donations(id) on delete cascade,
  sponsor_level_id uuid references public.sponsor_levels(id),
  type certificate_type not null,
  status certificate_status not null default 'active',
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  render_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type = 'donation' and donation_id is not null)
    or
    (type = 'honor' and sponsor_level_id is not null)
  )
);

create unique index certificates_one_donation_per_donation_id
on public.certificates (donation_id)
where type = 'donation' and donation_id is not null;

create unique index certificates_one_honor_per_user_sponsor_level
on public.certificates (user_id, sponsor_level_id)
where type = 'honor' and sponsor_level_id is not null;

create or replace function public.validate_certificate_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  donation_user_id uuid;
begin
  if new.type = 'donation' and new.donation_id is not null then
    select donations.user_id into donation_user_id
    from public.donations
    where donations.id = new.donation_id;

    if donation_user_id is not null and donation_user_id <> new.user_id then
      raise exception 'Donation certificate user_id must match donation user_id';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_certificate_ownership_before_write
before insert or update of user_id, donation_id, type on public.certificates
for each row execute function public.validate_certificate_ownership();

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid not null,
  before jsonb,
  after jsonb,
  reason text not null,
  created_at timestamptz not null default now()
);

insert into public.donation_tiers (code, label, description, amount, compare_at_amount, currency, sort_order) values
  ('monthly', 'Monthly Support', 'One-time support equal to a monthly contribution.', 900, null, 'usd', 1),
  ('quarterly', 'Quarterly Support', 'One-time support equal to a quarterly contribution.', 2430, 2700, 'usd', 2),
  ('yearly', 'Yearly Support', 'One-time support equal to a yearly contribution.', 8640, 10800, 'usd', 3);

insert into public.sponsor_levels (code, label, minimum_total_amount, currency, sort_order) values
  ('bronze', 'Bronze', 500, 'usd', 1),
  ('silver', 'Silver', 5000, 'usd', 2),
  ('gold', 'Gold', 15000, 'usd', 3),
  ('platinum', 'Platinum', 50000, 'usd', 4);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

alter table public.profiles enable row level security;
alter table public.donation_tiers enable row level security;
alter table public.sponsor_levels enable row level security;
alter table public.donations enable row level security;
alter table public.certificates enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_admin = false);
create policy "tiers_public_read" on public.donation_tiers for select using (is_active = true);
create policy "levels_public_read" on public.sponsor_levels for select using (is_active = true);
create policy "donations_select_own_or_admin" on public.donations for select using (user_id = auth.uid() or public.is_admin());
create policy "certificates_select_own_or_admin" on public.certificates for select using (user_id = auth.uid() or public.is_admin());
create policy "audit_admin_read" on public.admin_audit_logs for select using (public.is_admin());
