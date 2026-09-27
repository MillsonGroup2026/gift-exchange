-- ============================================================================
-- 0012 — optional photo for an item or a sub-item.
--   * New public Storage bucket `item-images` (photos aren't secret — the owner
--     wants everyone who can see the list to see them; paths are unguessable).
--   * Additive nullable columns image_url on list_items and list_item_options
--     (existing rows get NULL → nothing changes for them).
--   * Storage policies: anyone may READ; only the signed-in owner may write into
--     their own {uid}/… folder.
--   * get_shared_list returns the image_url for items and options.
-- Purely additive: no existing row is modified.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 15728640, array['image/*'])
on conflict (id) do update
  set public = true, file_size_limit = 15728640, allowed_mime_types = array['image/*'];

alter table public.list_items add column if not exists image_url text;
alter table public.list_item_options add column if not exists image_url text;

-- Anyone can read item photos.
drop policy if exists "item_images_read" on storage.objects;
create policy "item_images_read" on storage.objects
  for select using (bucket_id = 'item-images');

-- Only the signed-in owner can write into their own uid-prefixed folder.
drop policy if exists "item_images_insert" on storage.objects;
create policy "item_images_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "item_images_update" on storage.objects;
create policy "item_images_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "item_images_delete" on storage.objects;
create policy "item_images_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Public share view: include the image_url on items and options.
create or replace function public.get_shared_list(p_token text)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select case when l.id is null then null else jsonb_build_object(
    'list', jsonb_build_object('id', l.id, 'title', l.title, 'occasion', l.occasion,
      'owner_name', (select p.display_name from public.profiles p where p.id = l.owner_id)),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'title', i.title, 'description', i.description, 'priority', i.priority,
        'url', i.url, 'link_meta', i.link_meta, 'links', i.links, 'image_url', i.image_url,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'url', o.url, 'link_meta', o.link_meta, 'note', o.note, 'image_url', o.image_url) order by o.position)
          from public.list_item_options o where o.item_id = i.id
        ), '[]'::jsonb)
      ) order by i.position)
      from public.list_items i where i.list_id = l.id and i.deleted_at is null
    ), '[]'::jsonb)
  ) end
  from public.lists l where l.public_share_token = p_token and l.status = 'shared' limit 1;
$fn$;
