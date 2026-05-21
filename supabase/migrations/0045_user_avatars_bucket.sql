-- Create avatars bucket for user profile images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-avatars', 'user-avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Allow public access to read avatars
create policy "Public Read Access"
on storage.objects for select
to public
using (bucket_id = 'user-avatars');

-- Allow authenticated users to upload their own avatar
create policy "Auth users can upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'user-avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own avatar
create policy "Auth users can update own avatar"
on storage.objects for update
to authenticated
with check (
  bucket_id = 'user-avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own avatar
create policy "Auth users can delete own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'user-avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role full access
create policy "Service role full access on avatars"
on storage.objects for all
to service_role
using (bucket_id = 'user-avatars')
with check (bucket_id = 'user-avatars');
