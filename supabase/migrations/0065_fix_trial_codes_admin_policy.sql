drop policy if exists "trial_codes_admin_all" on public.trial_codes;

create policy "trial_codes_admin_all"
  on public.trial_codes for all
  using (public.is_admin())
  with check (public.is_admin());
