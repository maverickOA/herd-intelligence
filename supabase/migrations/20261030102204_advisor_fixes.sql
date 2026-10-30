-- =============================================================================
-- Herd Intelligence · M1 · Fixes from the Supabase security and performance advisors
--
-- 1. Indexes that fully cover the composite tenant foreign keys.
-- 2. SECURITY DEFINER RPCs move to the private app schema; the public API keeps
--    thin SECURITY INVOKER wrappers with the same names and arguments.
-- 3. platform_admins gets an explicit deny-all policy to document intent.
-- =============================================================================

-- 1. Covering indexes for (farm_id, org_id) and (membership_id, org_id).
create index farm_assignments_farm_org_idx on public.farm_assignments (farm_id, org_id);
create index farm_assignments_membership_org_idx on public.farm_assignments (membership_id, org_id);
drop index public.farm_assignments_farm_id_idx;

create index pens_farm_org_idx on public.pens (farm_id, org_id);
drop index public.pens_farm_id_idx;

-- 2. Move the privileged implementations out of the exposed schema.
alter function public.create_organization(text, text) set schema app;
alter function public.create_invitation(uuid, text, public.member_role, uuid[], integer) set schema app;
alter function public.accept_invitation(text) set schema app;

revoke all on function
  app.create_organization(text, text),
  app.create_invitation(uuid, text, public.member_role, uuid[], integer),
  app.accept_invitation(text)
from public, anon;
grant execute on function
  app.create_organization(text, text),
  app.create_invitation(uuid, text, public.member_role, uuid[], integer),
  app.accept_invitation(text)
to authenticated;

create function public.create_organization(p_name text, p_first_farm_name text default null)
returns uuid
language sql security invoker set search_path = '' as $$
  select app.create_organization(p_name, p_first_farm_name);
$$;
comment on function public.create_organization(text, text) is
  'Create an organization; the caller becomes its owner. Optionally creates the first farm.';

create function public.create_invitation(
  p_org uuid,
  p_email text,
  p_role public.member_role,
  p_farm_ids uuid[] default '{}',
  p_valid_days integer default 7
)
returns text
language sql security invoker set search_path = '' as $$
  select app.create_invitation(p_org, p_email, p_role, p_farm_ids, p_valid_days);
$$;
comment on function public.create_invitation(uuid, text, public.member_role, uuid[], integer) is
  'Owners only. Returns the invitation token once; only its SHA-256 is stored.';

create function public.accept_invitation(p_token text)
returns uuid
language sql security invoker set search_path = '' as $$
  select app.accept_invitation(p_token);
$$;
comment on function public.accept_invitation(text) is
  'Accept an invitation while signed in with the invited email address. Returns the organization id.';

revoke all on function
  public.create_organization(text, text),
  public.create_invitation(uuid, text, public.member_role, uuid[], integer),
  public.accept_invitation(text)
from public, anon;
grant execute on function
  public.create_organization(text, text),
  public.create_invitation(uuid, text, public.member_role, uuid[], integer),
  public.accept_invitation(text)
to authenticated;

-- 3. Explicit: no client can ever read platform_admins.
create policy platform_admins_no_client_access on public.platform_admins
  for select to authenticated using (false);
