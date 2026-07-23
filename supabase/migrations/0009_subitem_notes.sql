-- ============================================================================
-- 0009 — a sub-item (option) may be a link, a note, or both (not just name/url).
-- ============================================================================

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.list_item_options'::regclass and contype = 'c' limit 1;
  if c is not null then execute 'alter table public.list_item_options drop constraint ' || quote_ident(c); end if;
end $$;
alter table public.list_item_options
  add constraint list_item_options_has_content check (name is not null or url is not null or note is not null);

-- Include the note in the public share view.
create or replace function public.get_shared_list(p_token text)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select case when l.id is null then null else jsonb_build_object(
    'list', jsonb_build_object('id', l.id, 'title', l.title, 'occasion', l.occasion,
      'owner_name', (select p.display_name from public.profiles p where p.id = l.owner_id)),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'description', i.description, 'priority', i.priority,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'url', o.url, 'link_meta', o.link_meta, 'note', o.note) order by o.position)
          from public.list_item_options o where o.item_id = i.id
        ), '[]'::jsonb)
      ) order by i.position)
      from public.list_items i where i.list_id = l.id and i.deleted_at is null
    ), '[]'::jsonb)
  ) end
  from public.lists l where l.public_share_token = p_token and l.status = 'shared' limit 1;
$fn$;
