-- ============================================================================
-- 0006 — multiple links per item + Secret Santa full-coverage draws.
-- ============================================================================

-- Multiple links per item: JSONB array of { url, label, link_meta }.
alter table public.list_items add column if not exists links jsonb not null default '[]'::jsonb;

-- Migrate any existing single url into the new array.
update public.list_items
set links = jsonb_build_array(jsonb_build_object('url', url, 'label', null, 'link_meta', link_meta))
where url is not null and (links is null or links = '[]'::jsonb);

-- Secret Santa: allow a giver to be assigned MORE than one recipient (needed so
-- everyone receives when teams are uneven), but never the exact same pair twice.
alter table public.santa_assignments
  drop constraint if exists santa_assignments_exchange_id_giver_user_id_key;
create unique index if not exists santa_assignments_pair_uq
  on public.santa_assignments (exchange_id, giver_user_id, recipient_user_id);

-- Public share view: include the links array.
create or replace function public.get_shared_list(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when l.id is null then null else jsonb_build_object(
    'list', jsonb_build_object(
      'id', l.id, 'title', l.title, 'occasion', l.occasion,
      'owner_name', (select p.display_name from public.profiles p where p.id = l.owner_id)
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'title', i.title, 'description', i.description,
        'url', i.url, 'link_meta', i.link_meta, 'links', i.links,
        'priority', i.priority, 'quantity', i.quantity
      ) order by i.position)
      from public.list_items i where i.list_id = l.id and i.deleted_at is null
    ), '[]'::jsonb)
  ) end
  from public.lists l
  where l.public_share_token = p_token and l.status = 'shared'
  limit 1;
$$;
