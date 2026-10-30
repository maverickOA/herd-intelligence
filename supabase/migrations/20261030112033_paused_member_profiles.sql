-- =============================================================================
-- Herd Intelligence · M1 · Keep paused members' names visible to their team
--
-- shares_org_with() required both people to be active, so pausing someone hid
-- their name and email from the owner who needs to decide whether to restore
-- them. The viewer must still be active; the other person may be paused.
-- =============================================================================

create or replace function app.shares_org_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.memberships me
      join public.memberships them on them.org_id = me.org_id
     where me.user_id = (select auth.uid()) and me.status = 'active'
       and them.user_id = p_user
  );
$$;
