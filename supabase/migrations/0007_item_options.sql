-- ============================================================================
-- 0007 — sub-items (claimable options).
--   An item with NO options is claimed as a whole. An item WITH options is a
--   heading; each option is claimed individually. Claims target (item, option?).
-- ============================================================================

create table if not exists public.list_item_options (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.list_items (id) on delete cascade,
  name       text,
  url        text,
  link_meta  jsonb,
  note       text,
  position   double precision not null default 0,
  created_at timestamptz not null default now(),
  check (name is not null or url is not null)
);
create index if not exists list_item_options_item_idx on public.list_item_options (item_id);

-- Migrate any existing item.links jsonb into option rows.
insert into public.list_item_options (item_id, name, url, link_meta, position)
select i.id,
       nullif(coalesce(l ->> 'label', l -> 'link_meta' ->> 'title'), ''),
       l ->> 'url',
       l -> 'link_meta',
       (ord - 1)::double precision
from public.list_items i,
     lateral jsonb_array_elements(i.links) with ordinality as t(l, ord)
where jsonb_typeof(i.links) = 'array' and jsonb_array_length(i.links) > 0;

-- Claims can now target a specific option.
alter table public.claims add column if not exists option_id uuid
  references public.list_item_options (id) on delete cascade;
create index if not exists claims_option_idx on public.claims (option_id);
-- At most one claim per option (whole-item single-claim is enforced in the RPC).
create unique index if not exists claims_option_uq on public.claims (option_id) where option_id is not null;

alter table public.list_item_options enable row level security;

drop policy if exists list_item_options_select on public.list_item_options;
create policy list_item_options_select on public.list_item_options
  for select to authenticated
  using (public.can_access_list(public.item_list_id(item_id)));

drop policy if exists list_item_options_owner on public.list_item_options;
create policy list_item_options_owner on public.list_item_options
  for all to authenticated
  using (public.is_list_owner(public.item_list_id(item_id)))
  with check (public.is_list_owner(public.item_list_id(item_id)));

-- ----------------------------------------------------------------------------
-- Claim an item (whole) or a specific option. Row lock serializes races.
-- ----------------------------------------------------------------------------
create or replace function public.claim_target(
  p_item_id uuid,
  p_option_id uuid default null,
  p_status text default 'planning'
)
returns public.claims language plpgsql security definer set search_path = public as $$
declare
  v_list_id     uuid;
  v_row         public.claims;
  v_has_options boolean;
begin
  select list_id into v_list_id
  from public.list_items where id = p_item_id and deleted_at is null
  for update;

  if v_list_id is null then raise exception 'item_not_found'; end if;
  if public.is_list_owner(v_list_id) then raise exception 'owner_cannot_claim'; end if;
  if not public.can_access_list(v_list_id) then raise exception 'no_access'; end if;
  if p_status not in ('planning', 'purchased') then raise exception 'invalid_status'; end if;

  select exists (select 1 from public.list_item_options where item_id = p_item_id) into v_has_options;

  if p_option_id is not null then
    if not exists (select 1 from public.list_item_options where id = p_option_id and item_id = p_item_id) then
      raise exception 'option_not_found';
    end if;
    if exists (select 1 from public.claims where option_id = p_option_id) then
      raise exception 'already_claimed';
    end if;
    insert into public.claims (item_id, option_id, claimer_id, quantity, status)
    values (p_item_id, p_option_id, auth.uid(), 1, p_status)
    returning * into v_row;
  else
    if v_has_options then raise exception 'has_options'; end if;
    if exists (select 1 from public.claims where item_id = p_item_id and option_id is null) then
      raise exception 'already_claimed';
    end if;
    insert into public.claims (item_id, option_id, claimer_id, quantity, status)
    values (p_item_id, null, auth.uid(), 1, p_status)
    returning * into v_row;
  end if;

  return v_row;
end;
$$;
grant execute on function public.claim_target(uuid, uuid, text) to authenticated;
