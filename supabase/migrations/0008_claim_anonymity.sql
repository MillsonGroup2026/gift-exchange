-- ============================================================================
-- 0008 — optional anonymous claiming.
--   Default is to show who claimed. A user can claim anonymously (per-claim,
--   prompted each time, defaulting to their profile preference). Anonymous
--   claims hide the claimer from OTHER givers — redacted at the DB via
--   list_claims(). The owner still sees nothing either way.
-- ============================================================================

alter table public.profiles add column if not exists default_anonymous boolean not null default false;
alter table public.claims add column if not exists anonymous boolean not null default false;

-- Replace claim_target with an anonymity-aware version.
drop function if exists public.claim_target(uuid, uuid, text);
create or replace function public.claim_target(
  p_item_id uuid,
  p_option_id uuid default null,
  p_status text default 'planning',
  p_anonymous boolean default false
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
    insert into public.claims (item_id, option_id, claimer_id, quantity, status, anonymous)
    values (p_item_id, p_option_id, auth.uid(), 1, p_status, coalesce(p_anonymous, false))
    returning * into v_row;
  else
    if v_has_options then raise exception 'has_options'; end if;
    if exists (select 1 from public.claims where item_id = p_item_id and option_id is null) then
      raise exception 'already_claimed';
    end if;
    insert into public.claims (item_id, option_id, claimer_id, quantity, status, anonymous)
    values (p_item_id, null, auth.uid(), 1, p_status, coalesce(p_anonymous, false))
    returning * into v_row;
  end if;

  return v_row;
end;
$$;
grant execute on function public.claim_target(uuid, uuid, text, boolean) to authenticated;

-- Redacting reader for the giver view: hides claimer_id on anonymous claims that
-- aren't the caller's own, and returns nothing to the list owner.
create or replace function public.list_claims(p_list_id uuid)
returns table (
  id uuid, item_id uuid, option_id uuid, claimer_id uuid,
  quantity integer, status text, anonymous boolean, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.id, c.item_id, c.option_id,
    case when c.anonymous and c.claimer_id <> auth.uid() then null else c.claimer_id end,
    c.quantity, c.status, c.anonymous, c.created_at
  from public.claims c
  join public.list_items i on i.id = c.item_id
  where i.list_id = p_list_id
    and not public.is_list_owner(p_list_id)
    and public.can_access_list(p_list_id);
$$;
grant execute on function public.list_claims(uuid) to authenticated;
