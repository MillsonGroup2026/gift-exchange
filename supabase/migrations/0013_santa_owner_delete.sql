-- ============================================================================
-- 0013 — the group creator/admin can delete ANY Secret Santa exchange in their
-- group, not only ones they personally organized.
--   Previously santa_exchanges delete was organizer-only (santa_exchanges_manage
--   uses organizer_id = auth.uid()), so a group owner couldn't remove exchanges
--   that other members created. This adds a permissive DELETE policy for the
--   group owner; nothing is removed (organizers can still delete their own).
--   Child rows (participants, teams, rules, exclusions, assignments) are removed
--   by the existing ON DELETE CASCADE, which is not subject to RLS.
-- ============================================================================

drop policy if exists santa_exchanges_owner_delete on public.santa_exchanges;
create policy santa_exchanges_owner_delete on public.santa_exchanges
  for delete to authenticated
  using (public.is_group_owner(group_id));
