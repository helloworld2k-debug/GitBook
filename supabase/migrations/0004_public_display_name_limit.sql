alter table public.profiles
add constraint profiles_public_display_name_length
check (public_display_name is null or char_length(public_display_name) <= 80);
