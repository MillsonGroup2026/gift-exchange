-- ============================================================================
-- 0003_sharing_claims_comments.sql — Phases 3 & 4: the privacy layer
--
-- THE INVARIANT: a list owner must never be able to read any claim or comment
-- on their own list. Enforced here in RLS (owner reads return zero rows), never
-- in the front end. Verified by scripts/privacy-regression.mjs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Sharing: who can see a list as a giver.
-- ----------------------------------------------------------------------------
create table if not exists public.list_shares (
  id                    uuid primary key default gen_random_uuid(),
  list_id               uuid not null references public.lists (id) on delete cascade,
  shared_with_user_id   uuid references auth.users (id) on delete cascade,
  shared_with_email     text,
  shared_with_group_id  uuid,   -- groups arrive in a later phase
  source                text not null default 'invite' check (source in ('invite', 'link')),
  created_at            timestamptz not null default now(),
  check (
    shared_with_user_id is not null
    or shared_with_email is not null
    or shared_with_group_id is not null
  )
);
create index if not exists list_shares_list_idx on public.list_shares (list_id);
create index if not exists list_shares_user_idx on public.list_shares (shared_with_user_id);
create index if not exists list_shares_email_idx on public.list_shares (lower(shared_with_email));

-- ----------------------------------------------------------------------------
-- Access helpers. SECURITY DEFINER so they can read across tables without
-- tripping RLS recursion; each is careful to key off auth.uid()/auth.jwt().
-- ----------------------------------------------------------------------------
create or replace function public.is_list_owner(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lists l
    where l.id = p_list_id and l.owner_id = auth.uid()
  );
$$;

create or replace function public.can_access_list(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lists l
    where l.id = p_list_id
      and (
        l.owner_id = auth.uid()
        or (
          l.status = 'shared'
          and exists (
            select 1 from public.list_shares s
            where s.list_id = l.id
              and (
                s.shared_with_user_id = auth.uid()
                or lower(s.shared_with_email) = lower(auth.jwt() ->> 'email')
              )
          )
        )
      )
  );
$$;

create or replace function public.item_list_id(p_item_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select list_id from public.list_items where id = p_item_id;
$$;

-- ----------------------------------------------------------------------------
-- Claims and comments.
-- ----------------------------------------------------------------------------
create table if not exists public.claims (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.list_items (id) on delete cascade,
  claimer_id  uuid not null references auth.users (id) on delete cascade,
  quantity    integer not null default 1 check (quantity >= 1),
  status      text not null default 'planning' check (status in ('planning', 'purchased')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists claims_item_idx on public.claims (item_id);
create index if not exists claims_claimer_idx on public.claims (claimer_id);

create trigger claims_set_updated_at
  before update on public.claims
  for each row execute function public.set_updated_at();

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists (id) on delete cascade,
  item_id     uuid references public.list_items (id) on delete cascade,  -- null = whole-list comment
  author_id   uuid not null references auth.users (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists comments_list_idx on public.comments (list_id);
create index if not exists comments_item_idx on public.comments (item_id);

alter table public.list_shares enable row level security;
alter table public.claims enable row level security;
alter table public.comments enable row level security;

-- ----------------------------------------------------------------------------
-- RLS: lists / items — add giver read access on top of the owner policies.
-- ----------------------------------------------------------------------------
drop policy if exists lists_viewer_select on public.lists;
create policy lists_viewer_select on public.lists
  for select to authenticated
  using (public.can_access_list(id));

drop policy if exists list_items_viewer_select on public.list_items;
create policy list_items_viewer_select on public.list_items
  for select to authenticated
  using (public.can_access_list(list_id));

-- ----------------------------------------------------------------------------
-- RLS: list_shares
-- ----------------------------------------------------------------------------
drop policy if exists list_shares_owner_all on public.list_shares;
create policy list_shares_owner_all on public.list_shares
  for all to authenticated
  using (public.is_list_owner(list_id))
  with check (public.is_list_owner(list_id));

drop policy if exists list_shares_self_select on public.list_shares;
create policy list_shares_self_select on public.list_shares
  for select to authenticated
  using (
    shared_with_user_id = auth.uid()
    or lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  );

-- ----------------------------------------------------------------------------
-- RLS: claims — THE INVARIANT. Owner is excluded via NOT is_list_owner(...),
-- so an owner's SELECT returns zero rows at the database level.
-- ----------------------------------------------------------------------------
drop policy if exists claims_select on public.claims;
create policy claims_select on public.claims
  for select to authenticated
  using (
    not public.is_list_owner(public.item_list_id(item_id))
    and public.can_access_list(public.item_list_id(item_id))
  );

drop policy if exists claims_insert on public.claims;
create policy claims_insert on public.claims
  for insert to authenticated
  with check (
    claimer_id = auth.uid()
    and not public.is_list_owner(public.item_list_id(item_id))
    and public.can_access_list(public.item_list_id(item_id))
  );

drop policy if exists claims_update_own on public.claims;
create policy claims_update_own on public.claims
  for update to authenticated
  using (claimer_id = auth.uid())
  with check (claimer_id = auth.uid());

drop policy if exists claims_delete_own on public.claims;
create policy claims_delete_own on public.claims
  for delete to authenticated
  using (claimer_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: comments — same owner-exclusion.
-- ----------------------------------------------------------------------------
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated
  using (
    not public.is_list_owner(list_id)
    and public.can_access_list(list_id)
  );

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_list_owner(list_id)
    and public.can_access_list(list_id)
  );

drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments
  for delete to authenticated
  using (author_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Atomic, race-safe claiming. Locks the item row so two simultaneous claims on
-- the last unit cannot both succeed. SECURITY DEFINER, so it re-checks access.
-- ----------------------------------------------------------------------------
create or replace function public.claim_item(
  p_item_id uuid,
  p_quantity integer default 1,
  p_status text default 'planning'
)
returns public.claims language plpgsql security definer set search_path = public as $$
declare
  v_list_id   uuid;
  v_item_qty  integer;
  v_claimed   integer;
  v_row       public.claims;
begin
  select list_id, quantity into v_list_id, v_item_qty
  from public.list_items where id = p_item_id and deleted_at is null
  for update;

  if v_list_id is null then raise exception 'item_not_found'; end if;
  if public.is_list_owner(v_list_id) then raise exception 'owner_cannot_claim'; end if;
  if not public.can_access_list(v_list_id) then raise exception 'no_access'; end if;
  if p_quantity < 1 then raise exception 'invalid_quantity'; end if;
  if p_status not in ('planning', 'purchased') then raise exception 'invalid_status'; end if;

  select coalesce(sum(quantity), 0) into v_claimed
  from public.claims where item_id = p_item_id;

  if v_claimed + p_quantity > v_item_qty then
    raise exception 'over_claim' using detail = (v_item_qty - v_claimed)::text;
  end if;

  insert into public.claims (item_id, claimer_id, quantity, status)
  values (p_item_id, auth.uid(), p_quantity, p_status)
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.claim_item(uuid, integer, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Public share link. Anyone with the token can VIEW list + items (no claims).
-- ----------------------------------------------------------------------------
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
        'url', i.url, 'link_meta', i.link_meta, 'priority', i.priority, 'quantity', i.quantity
      ) order by i.position)
      from public.list_items i where i.list_id = l.id and i.deleted_at is null
    ), '[]'::jsonb)
  ) end
  from public.lists l
  where l.public_share_token = p_token and l.status = 'shared'
  limit 1;
$$;
grant execute on function public.get_shared_list(text) to anon, authenticated;

-- Signed-in visitor redeems a token to gain giver access (records a share).
create or replace function public.redeem_share_token(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_list_id uuid;
begin
  select id into v_list_id from public.lists
  where public_share_token = p_token and status = 'shared';
  if v_list_id is null then raise exception 'invalid_token'; end if;
  if exists (select 1 from public.lists where id = v_list_id and owner_id = auth.uid()) then
    return v_list_id;
  end if;
  insert into public.list_shares (list_id, shared_with_user_id, source)
  select v_list_id, auth.uid(), 'link'
  where not exists (
    select 1 from public.list_shares
    where list_id = v_list_id and shared_with_user_id = auth.uid()
  );
  return v_list_id;
end;
$$;
grant execute on function public.redeem_share_token(text) to authenticated;

-- Revoking the token kills link-based access immediately.
create or replace function public.revoke_share_token(p_list_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_list_owner(p_list_id) then raise exception 'not_owner'; end if;
  update public.lists set public_share_token = null where id = p_list_id;
  delete from public.list_shares where list_id = p_list_id and source = 'link';
end;
$$;
grant execute on function public.revoke_share_token(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Realtime so givers see each other's claims/comments live (RLS still applies,
-- so the owner receives nothing).
-- ----------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'claims') then
    alter publication supabase_realtime add table public.claims;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments') then
    alter publication supabase_realtime add table public.comments;
  end if;
end $$;
