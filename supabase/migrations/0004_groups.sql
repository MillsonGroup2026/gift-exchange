-- ============================================================================
-- 0004_groups.sql — Phase 5: groups (overlapping membership, email invites +
-- identity linking, join links, share-to-group).
-- ============================================================================

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  is_public   boolean not null default false,
  join_token  text unique,
  created_at  timestamptz not null default now()
);
create index if not exists groups_owner_idx on public.groups (owner_id);

create table if not exists public.group_members (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete cascade,
  invited_email  text,
  role           text not null default 'member' check (role in ('owner', 'member')),
  status         text not null default 'active' check (status in ('invited', 'active')),
  created_at     timestamptz not null default now(),
  check (user_id is not null or invited_email is not null)
);
-- One membership per user per group; one pending invite per email per group.
create unique index if not exists group_members_user_uq
  on public.group_members (group_id, user_id) where user_id is not null;
create unique index if not exists group_members_email_uq
  on public.group_members (group_id, lower(invited_email)) where user_id is null;
create index if not exists group_members_user_idx on public.group_members (user_id);
create index if not exists group_members_email_idx on public.group_members (lower(invited_email));

-- ----------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER: bypass RLS to avoid recursion).
-- ----------------------------------------------------------------------------
create or replace function public.is_group_owner(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.groups g where g.id = p_group_id and g.owner_id = auth.uid());
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.groups g where g.id = p_group_id and g.owner_id = auth.uid())
      or exists (
        select 1 from public.group_members m
        where m.group_id = p_group_id and m.status = 'active' and m.user_id = auth.uid()
      );
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- groups: members can read; only the owner can manage.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select to authenticated using (public.is_group_member(id));

drop policy if exists groups_owner_manage on public.groups;
create policy groups_owner_manage on public.groups
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- group_members: members see the roster; owner manages; you can see/remove yourself.
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select to authenticated using (
    public.is_group_member(group_id)
    or user_id = auth.uid()
    or lower(invited_email) = lower(auth.jwt() ->> 'email')
  );

drop policy if exists group_members_owner_manage on public.group_members;
create policy group_members_owner_manage on public.group_members
  for all to authenticated
  using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id));

drop policy if exists group_members_leave on public.group_members;
create policy group_members_leave on public.group_members
  for delete to authenticated using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Identity linking: turn matching email invites into active memberships.
-- Called on sign-in (dashboard load).
-- ----------------------------------------------------------------------------
create or replace function public.claim_group_invites()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.group_members
     set user_id = auth.uid(), status = 'active'
   where user_id is null
     and lower(invited_email) = lower(auth.jwt() ->> 'email');
end;
$$;
grant execute on function public.claim_group_invites() to authenticated;

-- Join via an unguessable link (handles the "signed up under a different email"
-- case — no stranded invites).
create or replace function public.join_group_via_token(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_group_id uuid;
begin
  select id into v_group_id from public.groups where join_token = p_token;
  if v_group_id is null then raise exception 'invalid_token'; end if;

  update public.group_members
     set user_id = auth.uid(), status = 'active'
   where group_id = v_group_id and user_id is null
     and lower(invited_email) = lower(auth.jwt() ->> 'email');

  insert into public.group_members (group_id, user_id, status, role)
  select v_group_id, auth.uid(), 'active', 'member'
  where not exists (
    select 1 from public.group_members where group_id = v_group_id and user_id = auth.uid()
  );
  return v_group_id;
end;
$$;
grant execute on function public.join_group_via_token(text) to authenticated;

create or replace function public.get_group_preview(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when g.id is null then null else jsonb_build_object(
    'id', g.id, 'name', g.name,
    'owner_name', (select p.display_name from public.profiles p where p.id = g.owner_id),
    'member_count', (select count(*) from public.group_members m where m.group_id = g.id and m.status = 'active')
  ) end
  from public.groups g where g.join_token = p_token limit 1;
$$;
grant execute on function public.get_group_preview(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Extend list access: a list shared with a group is visible to its members.
-- ----------------------------------------------------------------------------
create or replace function public.can_access_list(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lists l
    where l.id = p_list_id
      and (
        l.owner_id = auth.uid()
        or (
          l.status = 'shared'
          and (
            exists (
              select 1 from public.list_shares s
              where s.list_id = l.id
                and (
                  s.shared_with_user_id = auth.uid()
                  or lower(s.shared_with_email) = lower(auth.jwt() ->> 'email')
                )
            )
            or exists (
              select 1 from public.list_shares s
              where s.list_id = l.id
                and s.shared_with_group_id is not null
                and public.is_group_member(s.shared_with_group_id)
            )
          )
        )
      )
  );
$$;
