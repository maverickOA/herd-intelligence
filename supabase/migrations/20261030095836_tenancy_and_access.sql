-- =============================================================================
-- Herd Intelligence · M1 · Tenancy and access
--
-- Organizations (tenants), people, roles, farms, pens, invitations and an audit
-- log, with Row Level Security on every table. Every tenant row carries org_id;
-- composite foreign keys make it impossible for a farm, pen or assignment to
-- point at another organization's rows.
--
-- Roles: owner (everything in the org), manager (assigned farms), worker and
-- vet (read assigned farms; field-record write rules arrive with M3/M4).
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Private schema for helpers. Not exposed through the Data API.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- One global counter so devices can pull "everything changed since N".
create sequence app.row_seq;
grant usage on sequence app.row_seq to authenticated, service_role;

create type public.member_role as enum ('owner', 'manager', 'worker', 'vet');
create type public.member_status as enum ('active', 'suspended');
create type public.pen_type as enum ('pen', 'paddock', 'kidding', 'quarantine', 'pasture', 'other');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 2 and 120),
  country_code  text not null default 'NG' check (country_code ~ '^[A-Z]{2}$'),
  currency_code text not null default 'NGN' check (currency_code ~ '^[A-Z]{3}$'),
  timezone      text not null default 'Africa/Lagos' check (length(timezone) <= 64),
  unit_system   text not null default 'metric' check (unit_system = 'metric'),
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  version       integer not null default 1,
  row_seq       bigint not null default nextval('app.row_seq'),
  deleted_at    timestamptz
);
comment on table public.organizations is 'A farm business. The tenant boundary for all data.';

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (length(full_name) <= 120),
  phone       text check (length(phone) <= 32),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  version     integer not null default 1,
  row_seq     bigint not null default nextval('app.row_seq')
);
comment on table public.profiles is 'One row per signed-in person, created automatically at sign-up.';

create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.platform_admins is 'Platform administrators. No client access; checked by server-side admin routes.';

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null,
  status      public.member_status not null default 'active',
  invited_by  uuid,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  version     integer not null default 1,
  row_seq     bigint not null default nextval('app.row_seq'),
  unique (org_id, user_id),
  unique (id, org_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.farms (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 120),
  address     text check (length(address) <= 300),
  latitude    numeric(9, 6) check (latitude between -90 and 90),
  longitude   numeric(9, 6) check (longitude between -180 and 180),
  timezone    text check (length(timezone) <= 64),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  version     integer not null default 1,
  row_seq     bigint not null default nextval('app.row_seq'),
  deleted_at  timestamptz,
  unique (id, org_id)
);
create index farms_org_id_idx on public.farms (org_id);

create table public.farm_assignments (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  membership_id  uuid not null,
  farm_id        uuid not null,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  version        integer not null default 1,
  row_seq        bigint not null default nextval('app.row_seq'),
  -- Both sides must belong to the same organization.
  foreign key (membership_id, org_id) references public.memberships (id, org_id) on delete cascade,
  foreign key (farm_id, org_id) references public.farms (id, org_id) on delete cascade,
  unique (membership_id, farm_id)
);
create index farm_assignments_farm_id_idx on public.farm_assignments (farm_id);
create index farm_assignments_org_id_idx on public.farm_assignments (org_id);

create table public.pens (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  farm_id     uuid not null,
  name        text not null check (length(btrim(name)) between 1 and 80),
  pen_type    public.pen_type not null default 'pen',
  capacity    integer check (capacity > 0),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  version     integer not null default 1,
  row_seq     bigint not null default nextval('app.row_seq'),
  deleted_at  timestamptz,
  foreign key (farm_id, org_id) references public.farms (id, org_id) on delete cascade
);
create index pens_farm_id_idx on public.pens (farm_id);
create index pens_org_id_idx on public.pens (org_id);
create unique index pens_farm_name_live_key on public.pens (farm_id, lower(name)) where deleted_at is null;

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  email        text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role         public.member_role not null,
  farm_ids     uuid[] not null default '{}',
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  accepted_by  uuid,
  revoked_at   timestamptz,
  invited_by   uuid not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  version      integer not null default 1,
  row_seq      bigint not null default nextval('app.row_seq')
);
create index invitations_org_id_idx on public.invitations (org_id);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid,
  actor       uuid,
  action      text not null check (action in ('insert', 'update', 'delete')),
  table_name  text not null,
  record_id   uuid,
  before      jsonb,
  after       jsonb,
  at          timestamptz not null default now()
);
create index audit_log_org_at_idx on public.audit_log (org_id, at desc);

-- -----------------------------------------------------------------------------
-- Access helpers (private schema, SECURITY DEFINER so they can read memberships
-- without recursing through RLS; every one is scoped to auth.uid()).
-- -----------------------------------------------------------------------------

create function app.org_role(p_org uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select m.role
    from public.memberships m
   where m.org_id = p_org
     and m.user_id = (select auth.uid())
     and m.status = 'active';
$$;

create function app.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.org_role(p_org) is not null;
$$;

create function app.is_org_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.org_role(p_org) = 'owner', false);
$$;

-- Owners see every farm in their organization; others only farms assigned to them.
-- Takes org_id and farm_id from the row being checked, so it never needs to look
-- the farm up (a just-inserted farm is not yet visible to a lookup).
create function app.has_farm_access(p_org uuid, p_farm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.memberships m
     where m.org_id = p_org
       and m.user_id = (select auth.uid())
       and m.status = 'active'
       and (
         m.role = 'owner'
         or exists (select 1 from public.farm_assignments fa
                     where fa.membership_id = m.id and fa.farm_id = p_farm)
       )
  );
$$;

-- Owners, and managers assigned to the farm, can change farm details and pens.
create function app.can_manage_farm(p_org uuid, p_farm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.memberships m
     where m.org_id = p_org
       and m.user_id = (select auth.uid())
       and m.status = 'active'
       and (
         m.role = 'owner'
         or (m.role = 'manager' and exists (
               select 1 from public.farm_assignments fa
                where fa.membership_id = m.id and fa.farm_id = p_farm))
       )
  );
$$;

-- True when the signed-in user and p_user are active members of a common organization.
create function app.shares_org_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.memberships me
      join public.memberships them on them.org_id = me.org_id
     where me.user_id = (select auth.uid()) and me.status = 'active'
       and them.user_id = p_user and them.status = 'active'
  );
$$;

create function app.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

revoke all on function
  app.org_role(uuid), app.is_org_member(uuid), app.is_org_owner(uuid),
  app.has_farm_access(uuid, uuid), app.can_manage_farm(uuid, uuid), app.shares_org_with(uuid),
  app.is_platform_admin()
from public, anon;
grant execute on function
  app.org_role(uuid), app.is_org_member(uuid), app.is_org_owner(uuid),
  app.has_farm_access(uuid, uuid), app.can_manage_farm(uuid, uuid), app.shares_org_with(uuid),
  app.is_platform_admin()
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Every update bumps version and row_seq and stamps who and when.
create function app.touch_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.version := old.version + 1;
  new.row_seq := nextval('app.row_seq');
  return new;
end;
$$;

-- Audit every change. The invitation token hash never enters the log.
create function app.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  uuid;
  v_org uuid;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old) - 'token_hash'; end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new) - 'token_hash'; end if;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;
  v_org := case
    when tg_table_name = 'organizations' then v_id
    else coalesce(v_new ->> 'org_id', v_old ->> 'org_id')::uuid
  end;
  insert into public.audit_log (org_id, actor, action, table_name, record_id, before, after)
  values (v_org, auth.uid(), lower(tg_op), tg_table_name, v_id, v_old, v_new);
  return null;
end;
$$;

-- An organization must always keep at least one active owner.
create function app.keep_an_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role <> 'owner' or old.status <> 'active' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' and new.status = 'active' then
    return new;
  end if;
  -- Allow cascades when the whole organization is being deleted.
  if not exists (select 1 from public.organizations where id = old.org_id) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1 from public.memberships
     where org_id = old.org_id and id <> old.id and role = 'owner' and status = 'active'
  ) then
    raise exception 'An organization must keep at least one active owner'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

-- Create a profile for every new auth user.
create function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function app.touch_row(), app.audit_row(), app.keep_an_owner(), app.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

do $$
declare t text;
begin
  foreach t in array array['organizations', 'profiles', 'memberships', 'farms', 'farm_assignments', 'pens', 'invitations'] loop
    execute format('create trigger touch_row before update on public.%I for each row execute function app.touch_row()', t);
  end loop;
  foreach t in array array['organizations', 'memberships', 'farms', 'farm_assignments', 'pens', 'invitations'] loop
    execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function app.audit_row()', t);
  end loop;
end $$;

create trigger keep_an_owner
  before update or delete on public.memberships
  for each row execute function app.keep_an_owner();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.organizations    enable row level security;
alter table public.profiles         enable row level security;
alter table public.platform_admins  enable row level security;
alter table public.memberships      enable row level security;
alter table public.farms            enable row level security;
alter table public.farm_assignments enable row level security;
alter table public.pens             enable row level security;
alter table public.invitations      enable row level security;
alter table public.audit_log        enable row level security;

-- organizations: created only through create_organization(); owners edit.
create policy organizations_select on public.organizations for select to authenticated
  using ((select app.is_org_member(id)) or (select app.is_platform_admin()));
create policy organizations_update on public.organizations for update to authenticated
  using ((select app.is_org_owner(id)))
  with check ((select app.is_org_owner(id)));

-- profiles: you, and people you share an organization with.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select app.shares_org_with(id)));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- platform_admins: RLS on, no policies, no grants: invisible to clients.

-- memberships: created only through RPCs; owners change roles; anyone can leave.
create policy memberships_select on public.memberships for select to authenticated
  using ((select app.is_org_member(org_id)));
create policy memberships_update on public.memberships for update to authenticated
  using ((select app.is_org_owner(org_id)))
  with check ((select app.is_org_owner(org_id)));
create policy memberships_delete on public.memberships for delete to authenticated
  using ((select app.is_org_owner(org_id)) or user_id = (select auth.uid()));

-- farms: visible to owners and assigned members; owners create; owners and assigned managers edit.
create policy farms_select on public.farms for select to authenticated
  using ((select app.has_farm_access(org_id, id)));
create policy farms_insert on public.farms for insert to authenticated
  with check ((select app.is_org_owner(org_id)));
create policy farms_update on public.farms for update to authenticated
  using ((select app.can_manage_farm(org_id, id)))
  with check ((select app.can_manage_farm(org_id, id)));

-- farm_assignments: members can see who works where; owners assign.
create policy farm_assignments_select on public.farm_assignments for select to authenticated
  using ((select app.is_org_member(org_id)));
create policy farm_assignments_insert on public.farm_assignments for insert to authenticated
  with check ((select app.is_org_owner(org_id)));
create policy farm_assignments_delete on public.farm_assignments for delete to authenticated
  using ((select app.is_org_owner(org_id)));

-- pens: visible with farm access; owners and assigned managers create and edit.
create policy pens_select on public.pens for select to authenticated
  using ((select app.has_farm_access(org_id, farm_id)));
create policy pens_insert on public.pens for insert to authenticated
  with check ((select app.can_manage_farm(org_id, farm_id)));
create policy pens_update on public.pens for update to authenticated
  using ((select app.can_manage_farm(org_id, farm_id)))
  with check ((select app.can_manage_farm(org_id, farm_id)));

-- invitations: owners only; created through create_invitation(); owners can revoke.
create policy invitations_select on public.invitations for select to authenticated
  using ((select app.is_org_owner(org_id)));
create policy invitations_update on public.invitations for update to authenticated
  using ((select app.is_org_owner(org_id)))
  with check ((select app.is_org_owner(org_id)));

-- audit_log: owners read their organization's log; nobody writes directly.
create policy audit_log_select on public.audit_log for select to authenticated
  using ((select app.is_org_owner(org_id)));

-- -----------------------------------------------------------------------------
-- Grants. New tables are not exposed to the Data API automatically, so every
-- privilege is explicit. Column lists stop clients from touching ids, org_id,
-- versions or audit columns; triggers maintain those.
-- -----------------------------------------------------------------------------

revoke all on public.organizations, public.profiles, public.platform_admins, public.memberships,
  public.farms, public.farm_assignments, public.pens, public.invitations, public.audit_log
from anon, authenticated;

grant select on public.organizations to authenticated;
grant update (name, country_code, currency_code, timezone, unit_system) on public.organizations to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

grant select, delete on public.memberships to authenticated;
grant update (role, status) on public.memberships to authenticated;

grant select on public.farms to authenticated;
grant insert (id, org_id, name, address, latitude, longitude, timezone) on public.farms to authenticated;
grant update (name, address, latitude, longitude, timezone) on public.farms to authenticated;

grant select, delete on public.farm_assignments to authenticated;
grant insert (id, org_id, membership_id, farm_id) on public.farm_assignments to authenticated;

grant select on public.pens to authenticated;
grant insert (id, org_id, farm_id, name, pen_type, capacity) on public.pens to authenticated;
grant update (name, pen_type, capacity, deleted_at) on public.pens to authenticated;

-- token_hash is readable by owners but useless without the raw token (192 random bits).
grant select on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;

grant select on public.audit_log to authenticated;

grant all on public.organizations, public.profiles, public.platform_admins, public.memberships,
  public.farms, public.farm_assignments, public.pens, public.invitations, public.audit_log
to service_role;

-- -----------------------------------------------------------------------------
-- RPCs (the only way to create organizations, invitations and memberships).
-- SECURITY DEFINER, each checks auth.uid() itself; anon cannot call them.
-- -----------------------------------------------------------------------------

create function public.create_organization(p_name text, p_first_farm_name text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org  uuid;
begin
  if v_user is null then
    raise exception 'Sign in to create an organization' using errcode = '42501';
  end if;
  insert into public.organizations (name, created_by) values (btrim(p_name), v_user)
  returning id into v_org;
  insert into public.memberships (org_id, user_id, role, created_by)
  values (v_org, v_user, 'owner', v_user);
  if nullif(btrim(p_first_farm_name), '') is not null then
    insert into public.farms (org_id, name, created_by) values (v_org, btrim(p_first_farm_name), v_user);
  end if;
  return v_org;
end;
$$;

-- Returns the raw invite token once. Only its SHA-256 is stored.
create function public.create_invitation(
  p_org uuid,
  p_email text,
  p_role public.member_role,
  p_farm_ids uuid[] default '{}',
  p_valid_days integer default 7
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_token text;
  v_farms uuid[] := coalesce(p_farm_ids, '{}');
begin
  if v_user is null or not app.is_org_owner(p_org) then
    raise exception 'Only an owner of this organization can invite people' using errcode = '42501';
  end if;
  if p_valid_days not between 1 and 30 then
    raise exception 'Invitations last between 1 and 30 days' using errcode = '22023';
  end if;
  if p_role <> 'owner' and cardinality(v_farms) = 0 then
    raise exception 'Choose at least one farm for a % invitation', p_role using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_farms) as x(farm_id)
     where not exists (select 1 from public.farms f
                        where f.id = x.farm_id and f.org_id = p_org and f.deleted_at is null)
  ) then
    raise exception 'Every farm must belong to this organization' using errcode = '22023';
  end if;

  -- One open invitation per person per organization.
  update public.invitations
     set revoked_at = now()
   where org_id = p_org and lower(email) = lower(btrim(p_email))
     and accepted_at is null and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (org_id, email, role, farm_ids, token_hash, expires_at, invited_by)
  values (
    p_org, lower(btrim(p_email)), p_role, v_farms,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    now() + make_interval(days => p_valid_days),
    v_user
  );
  return v_token;
end;
$$;

-- The invited person accepts while signed in with the invited email address.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_inv   public.invitations%rowtype;
  v_mid   uuid;
begin
  if v_user is null then
    raise exception 'Sign in to accept an invitation' using errcode = '42501';
  end if;

  select * into v_inv
    from public.invitations
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
   for update;

  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'This invitation is not valid. Ask the farm owner for a new one.' using errcode = '22023';
  end if;
  if v_email is null or v_email <> v_inv.email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;
  if exists (select 1 from public.memberships where org_id = v_inv.org_id and user_id = v_user) then
    raise exception 'You are already a member of this organization' using errcode = '23505';
  end if;

  insert into public.memberships (org_id, user_id, role, invited_by, created_by)
  values (v_inv.org_id, v_user, v_inv.role, v_inv.invited_by, v_user)
  returning id into v_mid;

  insert into public.farm_assignments (org_id, membership_id, farm_id, created_by)
  select v_inv.org_id, v_mid, f.id, v_user
    from public.farms f
   where f.id = any (v_inv.farm_ids) and f.org_id = v_inv.org_id and f.deleted_at is null;

  update public.invitations
     set accepted_at = now(), accepted_by = v_user
   where id = v_inv.id;

  return v_inv.org_id;
end;
$$;

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
