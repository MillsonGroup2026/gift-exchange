-- ============================================================================
-- 0005_secret_santa.sql — Secret Santa exchanges inside a group.
--
-- Secrecy: an assignment row is readable only by its giver — except the
-- organizer, who may read all (the "unhide to verify" toggle). Enforced in RLS.
-- Generation runs server-side with the service role after verifying the caller
-- is the organizer.
-- ============================================================================

create table if not exists public.santa_exchanges (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  organizer_id uuid not null references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  status       text not null default 'draft' check (status in ('draft', 'assigned')),
  created_at   timestamptz not null default now(),
  assigned_at  timestamptz
);
create index if not exists santa_exchanges_group_idx on public.santa_exchanges (group_id);

create table if not exists public.santa_participants (
  id          uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.santa_exchanges (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  team        text,
  created_at  timestamptz not null default now(),
  unique (exchange_id, user_id)
);
create index if not exists santa_participants_exchange_idx on public.santa_participants (exchange_id);

-- Members of from_team give to members of to_team. No rows for a team => that
-- team may give to anyone (except self / exclusions).
create table if not exists public.santa_rules (
  id          uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.santa_exchanges (id) on delete cascade,
  from_team   text not null,
  to_team     text not null,
  unique (exchange_id, from_team, to_team)
);
create index if not exists santa_rules_exchange_idx on public.santa_rules (exchange_id);

-- Never assign giver -> recipient (e.g. spouses).
create table if not exists public.santa_exclusions (
  id                uuid primary key default gen_random_uuid(),
  exchange_id       uuid not null references public.santa_exchanges (id) on delete cascade,
  giver_user_id     uuid not null references auth.users (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  unique (exchange_id, giver_user_id, recipient_user_id)
);
create index if not exists santa_exclusions_exchange_idx on public.santa_exclusions (exchange_id);

create table if not exists public.santa_assignments (
  id                uuid primary key default gen_random_uuid(),
  exchange_id       uuid not null references public.santa_exchanges (id) on delete cascade,
  giver_user_id     uuid not null references auth.users (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (exchange_id, giver_user_id)
);
create index if not exists santa_assignments_exchange_idx on public.santa_assignments (exchange_id);

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.santa_group_id(p_exchange_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select group_id from public.santa_exchanges where id = p_exchange_id;
$$;

create or replace function public.is_santa_organizer(p_exchange_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.santa_exchanges e
    where e.id = p_exchange_id and e.organizer_id = auth.uid()
  );
$$;

alter table public.santa_exchanges enable row level security;
alter table public.santa_participants enable row level security;
alter table public.santa_rules enable row level security;
alter table public.santa_exclusions enable row level security;
alter table public.santa_assignments enable row level security;

-- Exchanges: group members can see; organizer manages; creator must be a member.
drop policy if exists santa_exchanges_select on public.santa_exchanges;
create policy santa_exchanges_select on public.santa_exchanges
  for select to authenticated using (public.is_group_member(group_id));

drop policy if exists santa_exchanges_manage on public.santa_exchanges;
create policy santa_exchanges_manage on public.santa_exchanges
  for all to authenticated
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid() and public.is_group_member(group_id));

-- Participants: group members see the roster; organizer manages.
drop policy if exists santa_participants_select on public.santa_participants;
create policy santa_participants_select on public.santa_participants
  for select to authenticated using (public.is_group_member(public.santa_group_id(exchange_id)));

drop policy if exists santa_participants_manage on public.santa_participants;
create policy santa_participants_manage on public.santa_participants
  for all to authenticated
  using (public.is_santa_organizer(exchange_id))
  with check (public.is_santa_organizer(exchange_id));

-- Rules / exclusions: organizer only.
drop policy if exists santa_rules_manage on public.santa_rules;
create policy santa_rules_manage on public.santa_rules
  for all to authenticated
  using (public.is_santa_organizer(exchange_id))
  with check (public.is_santa_organizer(exchange_id));

drop policy if exists santa_exclusions_manage on public.santa_exclusions;
create policy santa_exclusions_manage on public.santa_exclusions
  for all to authenticated
  using (public.is_santa_organizer(exchange_id))
  with check (public.is_santa_organizer(exchange_id));

-- Assignments: your own row only — unless you're the organizer (reveal-all).
drop policy if exists santa_assignments_select on public.santa_assignments;
create policy santa_assignments_select on public.santa_assignments
  for select to authenticated using (
    giver_user_id = auth.uid() or public.is_santa_organizer(exchange_id)
  );
-- No user-facing insert/update/delete: generation uses the service role.
