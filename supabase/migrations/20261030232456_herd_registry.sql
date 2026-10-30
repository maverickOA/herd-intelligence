-- =============================================================================
-- Herd Intelligence · M3 · Herd registry and pedigree data
--
-- Species and breeds, animals (including ancestors known only from a seller's
-- papers), parentage with confidence and full history, purchase details kept
-- private to owners and managers, and an automatic per-animal timeline.
--
-- Integrity is enforced here, not only in the app: no animal can be its own
-- ancestor, sires are male and dams female, parents share the child's species
-- and organization, and a parent cannot be born after its offspring.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reference data
-- -----------------------------------------------------------------------------

create table public.species (
  code            text primary key check (code ~ '^[a-z_]{2,30}$'),
  name            text not null,
  male_term       text not null,
  female_term     text not null,
  young_term      text not null,
  birth_term      text not null,
  gestation_days  integer not null check (gestation_days between 20 and 400),
  created_at      timestamptz not null default now()
);
comment on table public.species is 'Species registry. Terms and gestation drive species-specific wording and due dates.';

insert into public.species (code, name, male_term, female_term, young_term, birth_term, gestation_days)
values ('goat', 'Goat', 'buck', 'doe', 'kid', 'kidding', 150);

create table public.breeds (
  id            uuid primary key default gen_random_uuid(),
  species_code  text not null references public.species (code),
  org_id        uuid references public.organizations (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 2 and 60),
  created_at    timestamptz not null default now()
);
comment on table public.breeds is 'Breeds. org_id null = shared list; otherwise a custom breed for one organization.';
create unique index breeds_name_key on public.breeds
  (species_code, coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index breeds_org_id_idx on public.breeds (org_id);

insert into public.breeds (species_code, name) values
  ('goat', 'Boer'),
  ('goat', 'Kalahari Red'),
  ('goat', 'Savanna'),
  ('goat', 'Kiko'),
  ('goat', 'Red Sokoto (Maradi)'),
  ('goat', 'Sahel'),
  ('goat', 'West African Dwarf'),
  ('goat', 'Anglo-Nubian'),
  ('goat', 'Saanen'),
  ('goat', 'Alpine'),
  ('goat', 'Crossbred');

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

create type public.animal_sex as enum ('male', 'female');
create type public.animal_status as enum
  ('active', 'breeding', 'pregnant', 'nursing', 'growing', 'quarantined', 'sold', 'deceased', 'culled');
-- born_on_farm / purchased / received: animals the farm has had.
-- pedigree_only: an ancestor known only from records (e.g. a seller's papers).
create type public.animal_origin as enum ('born_on_farm', 'purchased', 'received', 'pedigree_only');
create type public.parent_role as enum ('sire', 'dam');
create type public.parent_confidence as enum ('dna', 'observed', 'reported', 'assumed');

-- A pen must belong to the farm an animal is on.
alter table public.pens add constraint pens_id_farm_key unique (id, farm_id);

-- -----------------------------------------------------------------------------
-- Animals
-- -----------------------------------------------------------------------------

create table public.animals (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete cascade,
  farm_id               uuid,
  pen_id                uuid,
  species_code          text not null default 'goat' references public.species (code),
  breed_id              uuid references public.breeds (id),
  tag                   text check (length(btrim(tag)) between 1 and 40),
  name                  text check (length(btrim(name)) between 1 and 80),
  registration_number   text check (length(registration_number) <= 60),
  sex                   public.animal_sex not null,
  birth_date            date,
  birth_date_estimated  boolean not null default false,
  status                public.animal_status not null default 'active',
  origin                public.animal_origin not null,
  is_declared_founder   boolean not null default false,
  founder_note          text check (length(founder_note) <= 300),
  color                 text check (length(color) <= 60),
  markings              text check (length(markings) <= 200),
  notes                 text check (length(notes) <= 2000),
  created_at            timestamptz not null default now(),
  created_by            uuid default auth.uid(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid,
  version               integer not null default 1,
  row_seq               bigint not null default nextval('app.row_seq'),
  deleted_at            timestamptz,
  unique (id, org_id),
  foreign key (farm_id, org_id) references public.farms (id, org_id),
  foreign key (pen_id, farm_id) references public.pens (id, farm_id),
  -- Something to call it by.
  check (tag is not null or name is not null or registration_number is not null),
  -- Ancestors from papers live outside any farm; every other animal is on one.
  check ((origin = 'pedigree_only') = (farm_id is null)),
  check (farm_id is not null or pen_id is null),
  check (birth_date is not null or not birth_date_estimated)
);
comment on table public.animals is 'One row per animal, including ancestors known only from records (origin = pedigree_only).';

create unique index animals_org_tag_key on public.animals (org_id, lower(tag))
  where tag is not null and deleted_at is null;
create index animals_org_id_idx on public.animals (org_id, row_seq);
create index animals_farm_org_idx on public.animals (farm_id, org_id);
create index animals_pen_farm_idx on public.animals (pen_id, farm_id);
create index animals_breed_id_idx on public.animals (breed_id);
create index animals_species_code_idx on public.animals (species_code);

-- -----------------------------------------------------------------------------
-- Parentage
-- -----------------------------------------------------------------------------

create table public.animal_parentage (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  child_id    uuid not null,
  parent_id   uuid not null,
  role        public.parent_role not null,
  confidence  public.parent_confidence not null default 'reported',
  evidence    text check (length(evidence) <= 300),
  is_current  boolean not null default true,
  ended_at    timestamptz,
  ended_by    uuid,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  version     integer not null default 1,
  row_seq     bigint not null default nextval('app.row_seq'),
  foreign key (child_id, org_id) references public.animals (id, org_id) on delete cascade,
  foreign key (parent_id, org_id) references public.animals (id, org_id) on delete cascade,
  check (child_id <> parent_id),
  check (is_current = (ended_at is null))
);
comment on table public.animal_parentage is 'Parent links with history. Changing a parent ends the old row and adds a new one; rows are never edited in place.';

create unique index animal_parentage_current_key on public.animal_parentage (child_id, role) where is_current;
create index animal_parentage_child_org_idx on public.animal_parentage (child_id, org_id);
create index animal_parentage_parent_org_idx on public.animal_parentage (parent_id, org_id);
create index animal_parentage_org_idx on public.animal_parentage (org_id, row_seq);

-- Bumped on every pedigree change; breeding assessments record the value they used.
create table public.pedigree_revisions (
  org_id      uuid primary key references public.organizations (id) on delete cascade,
  revision    bigint not null default 0,
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Acquisitions (purchase details; price visible to owners and managers only)
-- -----------------------------------------------------------------------------

create table public.animal_acquisitions (
  animal_id      uuid primary key,
  org_id         uuid not null,
  acquired_on    date,
  source         text check (length(source) <= 120),
  price          numeric(14, 2) check (price >= 0),
  currency_code  text check (currency_code ~ '^[A-Z]{3}$'),
  notes          text check (length(notes) <= 500),
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  version        integer not null default 1,
  row_seq        bigint not null default nextval('app.row_seq'),
  foreign key (animal_id, org_id) references public.animals (id, org_id) on delete cascade,
  check (price is null or currency_code is not null)
);
create index animal_acquisitions_animal_org_idx on public.animal_acquisitions (animal_id, org_id);

-- -----------------------------------------------------------------------------
-- Timeline (written only by triggers)
-- -----------------------------------------------------------------------------

create table public.animal_events (
  id           bigint generated always as identity primary key,
  org_id       uuid not null,
  animal_id    uuid not null,
  event_type   text not null,
  summary      text not null,
  details      jsonb,
  actor        uuid,
  occurred_at  timestamptz not null default now(),
  foreign key (animal_id, org_id) references public.animals (id, org_id) on delete cascade
);
create index animal_events_animal_idx on public.animal_events (animal_id, org_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Access helpers
-- -----------------------------------------------------------------------------

-- Can register animals on this farm: owners, and managers or workers assigned to it.
create function app.can_work_farm(p_org uuid, p_farm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.memberships m
     where m.org_id = p_org
       and m.user_id = (select auth.uid())
       and m.status = 'active'
       and (
         m.role = 'owner'
         or (m.role in ('manager', 'worker') and exists (
               select 1 from public.farm_assignments fa
                where fa.membership_id = m.id and fa.farm_id = p_farm))
       )
  );
$$;

-- Can see an animal: farm animals need farm access; pedigree-only records are org-wide.
create function app.can_see_animal(p_org uuid, p_farm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_farm is null then app.is_org_member(p_org) else app.has_farm_access(p_org, p_farm) end;
$$;

-- Can edit an animal's record and pedigree: owners; managers of its farm; any
-- manager for pedigree-only records.
create function app.can_edit_animal(p_org uuid, p_farm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_farm is null then coalesce(app.org_role(p_org) in ('owner', 'manager'), false)
    else app.can_manage_farm(p_org, p_farm)
  end;
$$;

create function app.can_edit_pedigree(p_child uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select app.can_edit_animal(a.org_id, a.farm_id) from public.animals a where a.id = p_child), false);
$$;

revoke all on function app.can_work_farm(uuid, uuid), app.can_see_animal(uuid, uuid),
  app.can_edit_animal(uuid, uuid), app.can_edit_pedigree(uuid) from public, anon;
grant execute on function app.can_work_farm(uuid, uuid), app.can_see_animal(uuid, uuid),
  app.can_edit_animal(uuid, uuid), app.can_edit_pedigree(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Integrity triggers
-- -----------------------------------------------------------------------------

create function app.animal_label(p_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(concat_ws(' ', a.tag, case when a.name is not null and a.tag is not null then '(' || a.name || ')' else a.name end), ''),
                  a.registration_number, 'animal')
    from public.animals a where a.id = p_id;
$$;
revoke all on function app.animal_label(uuid) from public, anon, authenticated;

-- Checks one parent link against the rules. Raises with a plain-English message.
create function app.check_parent_link(p_child uuid, p_parent uuid, p_role public.parent_role) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.animals%rowtype;
  p public.animals%rowtype;
begin
  select * into c from public.animals where id = p_child;
  select * into p from public.animals where id = p_parent;
  if p_child = p_parent then
    raise exception 'An animal cannot be its own parent' using errcode = 'check_violation';
  end if;
  if p_role = 'sire' and p.sex <> 'male' then
    raise exception '% is female, so it cannot be a sire', app.animal_label(p_parent) using errcode = 'check_violation';
  end if;
  if p_role = 'dam' and p.sex <> 'female' then
    raise exception '% is male, so it cannot be a dam', app.animal_label(p_parent) using errcode = 'check_violation';
  end if;
  if p.species_code <> c.species_code then
    raise exception 'Parent and offspring must be the same species' using errcode = 'check_violation';
  end if;
  if c.birth_date is not null and p.birth_date is not null
     and not c.birth_date_estimated and not p.birth_date_estimated
     and p.birth_date >= c.birth_date then
    raise exception '% was born on or after % (% vs %)', app.animal_label(p_parent), app.animal_label(p_child),
      p.birth_date, c.birth_date using errcode = 'check_violation';
  end if;
end;
$$;
revoke all on function app.check_parent_link(uuid, uuid, public.parent_role) from public, anon, authenticated;

create function app.validate_parentage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.is_current then
    return new;
  end if;
  perform app.check_parent_link(new.child_id, new.parent_id, new.role);
  -- Serialize pedigree writes per organization so two edits cannot form a loop together.
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text, 0));
  if exists (
    with recursive anc(id) as (
      select p.parent_id from public.animal_parentage p where p.child_id = new.parent_id and p.is_current
      union
      select p.parent_id from public.animal_parentage p join anc on p.child_id = anc.id where p.is_current
    )
    select 1 from anc where id = new.child_id
  ) then
    raise exception 'That would make % its own ancestor', app.animal_label(new.child_id)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Editing an animal must not break links it is already part of.
create function app.validate_animal_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  if new.birth_date > current_date then
    raise exception 'Birth date cannot be in the future' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and (new.sex, new.species_code, new.birth_date, new.birth_date_estimated)
       is distinct from (old.sex, old.species_code, old.birth_date, old.birth_date_estimated) then
    for r in select child_id, parent_id, role from public.animal_parentage
              where is_current and (child_id = new.id or parent_id = new.id) loop
      perform app.check_parent_link(r.child_id, r.parent_id, r.role);
    end loop;
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Timeline, pedigree revision and housekeeping triggers
-- -----------------------------------------------------------------------------

create function app.add_event(p_org uuid, p_animal uuid, p_type text, p_summary text, p_details jsonb default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.animal_events (org_id, animal_id, event_type, summary, details, actor)
  values (p_org, p_animal, p_type, p_summary, p_details, auth.uid());
$$;
revoke all on function app.add_event(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

create function app.bump_pedigree_revision(p_org uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.pedigree_revisions (org_id, revision) values (p_org, 1)
  on conflict (org_id) do update set revision = public.pedigree_revisions.revision + 1, updated_at = now();
$$;
revoke all on function app.bump_pedigree_revision(uuid) from public, anon, authenticated;

create function app.animal_timeline() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pen text;
begin
  if tg_op = 'INSERT' then
    perform app.add_event(new.org_id, new.id, 'registered', case new.origin
      when 'born_on_farm' then 'Born on the farm and registered'
      when 'purchased' then 'Bought and registered'
      when 'received' then 'Received and registered'
      else 'Added from pedigree records' end);
    if new.is_declared_founder then
      perform app.bump_pedigree_revision(new.org_id);
    end if;
    return null;
  end if;

  if new.status is distinct from old.status then
    perform app.add_event(new.org_id, new.id, 'status',
      format('Status changed from %s to %s', initcap(old.status::text), initcap(new.status::text)),
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.farm_id is distinct from old.farm_id or new.pen_id is distinct from old.pen_id then
    select name into v_pen from public.pens where id = new.pen_id;
    perform app.add_event(new.org_id, new.id, 'moved',
      case
        when new.farm_id is distinct from old.farm_id then
          format('Moved to %s%s', (select name from public.farms where id = new.farm_id), coalesce(', ' || v_pen, ''))
        when v_pen is null then 'Taken out of its pen'
        else format('Moved to %s', v_pen)
      end,
      jsonb_build_object('farm_id', new.farm_id, 'pen_id', new.pen_id));
  end if;
  if new.is_declared_founder is distinct from old.is_declared_founder then
    perform app.add_event(new.org_id, new.id, 'founder',
      case when new.is_declared_founder then 'Marked as a founder (treated as unrelated, parents unknown)'
           else 'No longer marked as a founder' end);
    perform app.bump_pedigree_revision(new.org_id);
  end if;
  return null;
end;
$$;

create function app.parentage_timeline() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_word text := case new.role when 'sire' then 'Sire' else 'Dam' end;
begin
  if tg_op = 'INSERT' and new.is_current then
    perform app.add_event(new.org_id, new.child_id, 'parent_set',
      format('%s recorded: %s (%s)', v_word, app.animal_label(new.parent_id), new.confidence),
      jsonb_build_object('role', new.role, 'parent_id', new.parent_id, 'confidence', new.confidence));
    perform app.add_event(new.org_id, new.parent_id, 'offspring',
      format('Recorded as %s of %s', lower(v_word), app.animal_label(new.child_id)),
      jsonb_build_object('role', new.role, 'child_id', new.child_id));
  elsif tg_op = 'UPDATE' and old.is_current and not new.is_current then
    perform app.add_event(new.org_id, new.child_id, 'parent_removed',
      format('%s link to %s ended', v_word, app.animal_label(new.parent_id)),
      jsonb_build_object('role', new.role, 'parent_id', new.parent_id));
  elsif tg_op = 'UPDATE' and new.confidence is distinct from old.confidence then
    perform app.add_event(new.org_id, new.child_id, 'parent_confidence',
      format('%s confidence changed from %s to %s', v_word, old.confidence, new.confidence));
  end if;
  perform app.bump_pedigree_revision(new.org_id);
  return null;
end;
$$;

revoke all on function app.validate_parentage(), app.validate_animal_change(), app.animal_timeline(),
  app.parentage_timeline() from public, anon, authenticated;

create trigger validate_parentage before insert or update on public.animal_parentage
  for each row execute function app.validate_parentage();
-- AFTER, so the link checks read the animal's new values.
create trigger validate_animal_change after insert or update on public.animals
  for each row execute function app.validate_animal_change();
create trigger animal_timeline after insert or update on public.animals
  for each row execute function app.animal_timeline();
create trigger parentage_timeline after insert or update on public.animal_parentage
  for each row execute function app.parentage_timeline();

do $$
declare t text;
begin
  foreach t in array array['animals', 'animal_parentage', 'animal_acquisitions'] loop
    execute format('create trigger touch_row before update on public.%I for each row execute function app.touch_row()', t);
    execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function app.audit_row()', t);
  end loop;
end $$;

-- audit_row reads org_id; acquisitions are keyed by animal_id, so record that as the id.
create or replace function app.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  uuid;
  v_org uuid;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old) - 'token_hash'; end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new) - 'token_hash'; end if;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'animal_id', v_old ->> 'animal_id')::uuid;
  v_org := case
    when tg_table_name = 'organizations' then v_id
    else coalesce(v_new ->> 'org_id', v_old ->> 'org_id')::uuid
  end;
  insert into public.audit_log (org_id, actor, action, table_name, record_id, before, after)
  values (v_org, auth.uid(), lower(tg_op), tg_table_name, v_id, v_old, v_new);
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.species              enable row level security;
alter table public.breeds               enable row level security;
alter table public.animals              enable row level security;
alter table public.animal_parentage     enable row level security;
alter table public.pedigree_revisions   enable row level security;
alter table public.animal_acquisitions  enable row level security;
alter table public.animal_events        enable row level security;

create policy species_select on public.species for select to authenticated using (true);

create policy breeds_select on public.breeds for select to authenticated
  using (org_id is null or (select app.is_org_member(org_id)));
create policy breeds_insert on public.breeds for insert to authenticated
  with check (org_id is not null and coalesce((select app.org_role(org_id)) in ('owner', 'manager'), false));

create policy animals_select on public.animals for select to authenticated
  using ((select app.can_see_animal(org_id, farm_id)));
-- Workers can register animals on their farms; pedigree-only records need an owner or manager.
create policy animals_insert on public.animals for insert to authenticated
  with check (
    case when farm_id is null then (select app.can_edit_animal(org_id, null))
         else (select app.can_work_farm(org_id, farm_id)) end
  );
create policy animals_update on public.animals for update to authenticated
  using ((select app.can_edit_animal(org_id, farm_id)))
  with check ((select app.can_edit_animal(org_id, farm_id)));

create policy animal_parentage_select on public.animal_parentage for select to authenticated
  using (exists (select 1 from public.animals a where a.id = child_id));
create policy animal_parentage_insert on public.animal_parentage for insert to authenticated
  with check ((select app.can_edit_pedigree(child_id)));
create policy animal_parentage_update on public.animal_parentage for update to authenticated
  using ((select app.can_edit_pedigree(child_id)))
  with check ((select app.can_edit_pedigree(child_id)));

create policy pedigree_revisions_select on public.pedigree_revisions for select to authenticated
  using ((select app.is_org_member(org_id)));

create policy animal_acquisitions_select on public.animal_acquisitions for select to authenticated
  using (exists (select 1 from public.animals a where a.id = animal_id and app.can_edit_animal(a.org_id, a.farm_id)));
create policy animal_acquisitions_insert on public.animal_acquisitions for insert to authenticated
  with check (exists (select 1 from public.animals a
                       where a.id = animal_acquisitions.animal_id and a.org_id = animal_acquisitions.org_id
                         and app.can_edit_animal(a.org_id, a.farm_id)));
create policy animal_acquisitions_update on public.animal_acquisitions for update to authenticated
  using (exists (select 1 from public.animals a where a.id = animal_id and app.can_edit_animal(a.org_id, a.farm_id)))
  with check (exists (select 1 from public.animals a where a.id = animal_id and app.can_edit_animal(a.org_id, a.farm_id)));

create policy animal_events_select on public.animal_events for select to authenticated
  using (exists (select 1 from public.animals a where a.id = animal_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------

revoke all on public.species, public.breeds, public.animals, public.animal_parentage,
  public.pedigree_revisions, public.animal_acquisitions, public.animal_events from anon, authenticated;

grant select on public.species to authenticated;
grant select on public.breeds to authenticated;
grant insert (id, org_id, species_code, name) on public.breeds to authenticated;

grant select on public.animals to authenticated;
grant insert (id, org_id, farm_id, pen_id, species_code, breed_id, tag, name, registration_number, sex,
              birth_date, birth_date_estimated, status, origin, is_declared_founder, founder_note,
              color, markings, notes)
  on public.animals to authenticated;
grant update (farm_id, pen_id, breed_id, tag, name, registration_number, sex, birth_date,
              birth_date_estimated, status, is_declared_founder, founder_note, color, markings, notes)
  on public.animals to authenticated;

grant select on public.animal_parentage to authenticated;
grant insert (id, org_id, child_id, parent_id, role, confidence, evidence) on public.animal_parentage to authenticated;
grant update (is_current, ended_at, ended_by, confidence, evidence) on public.animal_parentage to authenticated;

grant select on public.pedigree_revisions to authenticated;

grant select on public.animal_acquisitions to authenticated;
grant insert (animal_id, org_id, acquired_on, source, price, currency_code, notes) on public.animal_acquisitions to authenticated;
grant update (acquired_on, source, price, currency_code, notes) on public.animal_acquisitions to authenticated;

grant select on public.animal_events to authenticated;

grant all on public.species, public.breeds, public.animals, public.animal_parentage,
  public.pedigree_revisions, public.animal_acquisitions, public.animal_events to service_role;

-- -----------------------------------------------------------------------------
-- RPCs (SECURITY INVOKER: they run with the caller's permissions and RLS)
-- -----------------------------------------------------------------------------

-- Set, change or clear one parent. Changing ends the old link (kept as history)
-- and adds a new one in the same transaction.
create function public.set_parent(
  p_child uuid,
  p_role public.parent_role,
  p_parent uuid,
  p_confidence public.parent_confidence default 'reported',
  p_evidence text default null
)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_org     uuid;
  v_current public.animal_parentage%rowtype;
  v_id      uuid;
begin
  if not app.can_edit_pedigree(p_child) then
    raise exception 'You don''t have permission to change this animal''s parents' using errcode = '42501';
  end if;
  select org_id into v_org from public.animals where id = p_child;

  select * into v_current from public.animal_parentage
   where child_id = p_child and role = p_role and is_current;

  if found and v_current.parent_id = p_parent then
    update public.animal_parentage
       set confidence = p_confidence, evidence = nullif(btrim(p_evidence), '')
     where id = v_current.id;
    return v_current.id;
  end if;

  if found then
    update public.animal_parentage
       set is_current = false, ended_at = now(), ended_by = auth.uid()
     where id = v_current.id;
  end if;

  if p_parent is not null then
    insert into public.animal_parentage (org_id, child_id, parent_id, role, confidence, evidence)
    values (v_org, p_child, p_parent, p_role, p_confidence, nullif(btrim(p_evidence), ''))
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
comment on function public.set_parent(uuid, public.parent_role, uuid, public.parent_confidence, text) is
  'Set, change (p_parent = new animal) or clear (p_parent = null) the sire or dam of an animal. History is kept.';

revoke all on function public.set_parent(uuid, public.parent_role, uuid, public.parent_confidence, text) from public, anon;
grant execute on function public.set_parent(uuid, public.parent_role, uuid, public.parent_confidence, text) to authenticated;
