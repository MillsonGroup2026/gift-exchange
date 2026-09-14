-- ============================================================================
-- 0010 — surface each group member's shared list(s) on the group page.
--   Returns the lists shared WITH this group that the caller can actually
--   access, tagged by owner, so the group roster can mark who has a list and
--   link straight to it. Leaks nothing about claims/comments (owner-blindness
--   is unaffected — this only exposes list existence + title, which is exactly
--   what "shared with the group" already means).
-- ============================================================================

create or replace function public.group_member_lists(p_group_id uuid)
returns table (list_id uuid, owner_id uuid, title text, occasion text)
language sql stable security definer set search_path = public as $$
  select distinct l.id, l.owner_id, l.title, l.occasion
  from public.lists l
  join public.list_shares s on s.list_id = l.id
  where s.shared_with_group_id = p_group_id
    and public.is_group_member(p_group_id)
    and public.can_access_list(l.id);
$$;
grant execute on function public.group_member_lists(uuid) to authenticated;
