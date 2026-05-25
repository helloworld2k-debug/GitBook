create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_display_name text;
  normalized_public_display_name text;
  requested_locale text;
begin
  requested_locale := new.raw_user_meta_data->>'preferred_locale';
  normalized_display_name := left(nullif(btrim(coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name'
  )), ''), 120);
  normalized_public_display_name := left(nullif(btrim(coalesce(
    new.raw_user_meta_data->>'public_display_name',
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name'
  )), ''), 80);

  insert into public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    preferred_locale,
    public_display_name,
    is_admin,
    email_verified
  )
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data->>'email', ''),
    normalized_display_name,
    nullif(btrim(new.raw_user_meta_data->>'avatar_url'), ''),
    case
      when requested_locale in ('en', 'zh-Hant', 'ja', 'ko') then requested_locale
      else 'en'
    end,
    normalized_public_display_name,
    false,
    new.email_confirmed_at is not null
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    public_display_name = coalesce(public.profiles.public_display_name, excluded.public_display_name),
    email_verified = public.profiles.email_verified or excluded.email_verified,
    updated_at = now();

  return new;
end;
$$;
