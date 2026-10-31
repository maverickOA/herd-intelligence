-- =============================================================================
-- Herd Intelligence · M4 · Breeding checks, matings, pregnancy checks, kidding
--
-- * breeding_policies: one per organization and species; owners set the
--   thresholds. Changing a threshold clears the advisor confirmation.
-- * breeding_assessments: immutable results of the pedigree engine. Only the
--   server-side "breeding" function (service role) can write them, after
--   running the engine on the full pedigree returned by breeding_pedigree().
--   A trigger re-checks the result against the policy before it is stored.
-- * mating_events (+ sires): every sire needs a fresh assessment by the same
--   person; restricted pairings need an owner or farm manager and a written
--   reason (assessment_overrides); high or insufficient need acknowledgement.
-- * pregnancy_checks, birth_events (+ offspring): kidding creates the kids
--   with their dam and sire set, or with candidate sires when several bucks
--   could be the father (animal_candidate_sires).
--
-- All writes except policy edits go through RPCs that check permissions
-- explicitly; clients get SELECT only.
-- =============================================================================

create type public.breeding_class as enum ('low', 'elevated', 'insufficient', 'high', 'restricted');
create type public.mating_method as enum ('pasture', 'hand', 'ai');
create type public.mating_outcome as enum ('awaiting_check', 'pregnant', 'not_pregnant', 'kidded');
create type public.pregnancy_method as enum ('ultrasound', 'blood_test', 'observation');
create type public.pregnancy_result as enum ('pregnant', 'not_pregnant', 'unsure');

-- -----------------------------------------------------------------------------
-- Breeding policy
-- -----------------------------------------------------------------------------

create table public.breeding_policies (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organizations (id) on delete cascade,
  species_code              text not null references public.species (code),
  low_band_max              numeric(7, 6) not null default 0.03125,
  high_band_min             numeric(7, 6) not null default 0.0625,
  max_coi                   numeric(7, 6) not null default 0.125,
  min_completeness          numeric(4, 3) not null default 0.7,
  generations               smallint not null default 3 check (generations between 1 and 6),
  blocked_relationships     text[] not null default array['parent-offspring', 'full-siblings', 'half-siblings'],
  allow_founder_assumption  boolean not null default true,
  advisor_name              text check (length(btrim(advisor_name)) between 2 and 120),
  advisor_note              text check (length(advisor_note) <= 1000),
  advisor_confirmed_on      date,
  created_at                timestamptz not null default now(),
  created_by                uuid default auth.uid(),
  updated_at                timestamptz not null default now(),
  updated_by                uuid,
  version                   integer not null default 1,
  row_seq                   bigint not null default nextval('app.row_seq'),
  unique (org_id, species_code),
  unique (id, org_id),
  check (0 < low_band_max and low_band_max <= high_band_min and high_band_min <= max_coi and max_coi <= 1),
  check (min_completeness between 0 and 1),
  check (blocked_relationships <@ array[
    'parent-offspring', 'grandparent-grandchild', 'great-grandparent-great-grandchild', 'direct-ancestor',
    'full-siblings', 'half-siblings', 'uncle-aunt-niece-nephew', 'half-uncle-aunt-niece-nephew',
    'first-cousins', 'half-first-cousins', 'double-first-cousins', 'second-cousins', 'half-second-cousins',
    'other-shared-ancestry']),
  check (advisor_confirmed_on is null or advisor_name is not null)
);
comment on table public.breeding_policies is
  'Inbreeding thresholds per organization and species. Defaults are starting values for a qualified breeding advisor to confirm.';
create index breeding_policies_species_idx on public.breeding_policies (species_code);

insert into public.breeding_policies (org_id, species_code)
select o.id, 'goat' from public.organizations o;

create function app.create_default_policy() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.breeding_policies (org_id, species_code) values (new.id, 'goat')
  on conflict do nothing;
  return null;
end;
$$;
create trigger create_default_policy after insert on public.organizations
  for each row execute function app.create_default_policy();

-- Changing a threshold means the advisor has not confirmed the new values.
create function app.policy_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.low_band_max, new.high_band_min, new.max_coi, new.min_completeness, new.generations,
      new.blocked_relationships, new.allow_founder_assumption)
     is distinct from
     (old.low_band_max, old.high_band_min, old.max_coi, old.min_completeness, old.generations,
      old.blocked_relationships, old.allow_founder_assumption)
     and new.advisor_confirmed_on is not distinct from old.advisor_confirmed_on then
    new.advisor_confirmed_on := null;
  end if;
  return new;
end;
$$;
create trigger policy_change before update on public.breeding_policies
  for each row execute function app.policy_change();

-- The policy as the engine reads it.
create function app.policy_json(p public.breeding_policies) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'speciesId', p.species_code,
    'lowBandMax', p.low_band_max,
    'highBandMin', p.high_band_min,
    'maxCoi', p.max_coi,
    'minCompleteness', p.min_completeness,
    'generations', p.generations,
    'blockedRelationships', to_jsonb(p.blocked_relationships),
    'allowFounderAssumption', p.allow_founder_assumption,
    'advisorName', p.advisor_name,
    'advisorNote', p.advisor_note);
$$;

-- -----------------------------------------------------------------------------
-- Candidate sires (uncertain paternity)
-- -----------------------------------------------------------------------------

create table public.animal_candidate_sires (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  child_id    uuid not null,
  sire_id     uuid not null,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  unique (child_id, sire_id),
  foreign key (child_id, org_id) references public.animals (id, org_id) on delete cascade,
  foreign key (sire_id, org_id) references public.animals (id, org_id) on delete cascade,
  check (child_id <> sire_id)
);
comment on table public.animal_candidate_sires is
  'Possible sires of an animal whose father is not known for sure (e.g. several bucks ran with the doe). Removed when a sire is recorded.';
create index animal_candidate_sires_child_org_idx on public.animal_candidate_sires (child_id, org_id);
create index animal_candidate_sires_sire_org_idx on public.animal_candidate_sires (sire_id, org_id);

create function app.validate_candidate_sire() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.check_parent_link(new.child_id, new.sire_id, 'sire');
  if exists (select 1 from public.animal_parentage
              where child_id = new.child_id and role = 'sire' and is_current) then
    raise exception '% already has a recorded sire', app.animal_label(new.child_id) using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text, 0));
  if exists (
    with recursive anc(id) as (
      select p.parent_id from public.animal_parentage p where p.child_id = new.sire_id and p.is_current
      union
      select p.parent_id from public.animal_parentage p join anc on p.child_id = anc.id where p.is_current
    )
    select 1 from anc where id = new.child_id
  ) then
    raise exception 'That would make % its own ancestor', app.animal_label(new.child_id) using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger validate_candidate_sire before insert on public.animal_candidate_sires
  for each row execute function app.validate_candidate_sire();

create function app.candidate_sires_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.bump_pedigree_revision(coalesce(new.org_id, old.org_id));
  return null;
end;
$$;
create trigger candidate_sires_changed after insert or delete on public.animal_candidate_sires
  for each row execute function app.candidate_sires_changed();

-- Recording a sire settles paternity: candidate sires are no longer needed.
create function app.resolve_candidate_sires() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'sire' and new.is_current then
    delete from public.animal_candidate_sires where child_id = new.child_id;
  end if;
  return null;
end;
$$;
create trigger resolve_candidate_sires after insert on public.animal_parentage
  for each row execute function app.resolve_candidate_sires();

-- -----------------------------------------------------------------------------
-- Assessments (written only by the server-side breeding function)
-- -----------------------------------------------------------------------------

create table public.breeding_assessments (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null,
  buck_id                  uuid not null,
  doe_id                   uuid not null,
  purpose                  text not null check (purpose in ('check', 'mating')),
  requested_by             uuid not null,
  engine_version           text not null check (length(engine_version) <= 20),
  pedigree_revision        bigint not null check (pedigree_revision >= 0),
  pedigree_hash            text not null check (pedigree_hash ~ '^[0-9a-f]{64}$'),
  policy_id                uuid not null,
  policy_version           integer not null,
  policy                   jsonb not null,
  classification           public.breeding_class not null,
  possible                 boolean not null,
  requires_override        boolean not null,
  known_coi                numeric not null check (known_coi between 0 and 1),
  verified_coi             numeric not null check (verified_coi between 0 and 1),
  worst_case_coi           numeric check (worst_case_coi between 0 and 1),
  classified_coi           numeric not null check (classified_coi between 0 and 1),
  completeness             numeric not null check (completeness between 0 and 1),
  uses_founder_assumption  boolean not null,
  relationships            text[] not null default '{}',
  result                   jsonb not null,
  created_at               timestamptz not null default now(),
  foreign key (buck_id, org_id) references public.animals (id, org_id) on delete cascade,
  foreign key (doe_id, org_id) references public.animals (id, org_id) on delete cascade,
  foreign key (policy_id, org_id) references public.breeding_policies (id, org_id) on delete cascade,
  check (buck_id <> doe_id),
  check (requires_override = (classification = 'restricted')),
  check (classified_coi >= known_coi),
  check (verified_coi <= known_coi)
);
comment on table public.breeding_assessments is
  'Immutable pedigree-engine results. Known COI is a floor: missing ancestors can only raise it.';
create index breeding_assessments_doe_idx on public.breeding_assessments (doe_id, org_id, created_at desc);
create index breeding_assessments_buck_idx on public.breeding_assessments (buck_id, org_id);
create index breeding_assessments_org_idx on public.breeding_assessments (org_id, created_at desc);
create index breeding_assessments_policy_idx on public.breeding_assessments (policy_id, org_id);

-- Defence in depth: the stored result must agree with the policy it claims to use.
create function app.check_assessment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_policy public.breeding_policies%rowtype;
  v_buck   public.animals%rowtype;
  v_doe    public.animals%rowtype;
  v_rev    bigint;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Breeding assessments cannot be changed' using errcode = '42501';
  end if;
  select * into v_buck from public.animals where id = new.buck_id;
  select * into v_doe from public.animals where id = new.doe_id;
  if v_buck.sex <> 'male' or v_doe.sex <> 'female' or v_buck.species_code <> v_doe.species_code then
    raise exception 'Assessment must pair a buck with a doe of the same species' using errcode = 'check_violation';
  end if;
  select * into v_policy from public.breeding_policies where id = new.policy_id;
  if v_policy.species_code <> v_doe.species_code or v_policy.version <> new.policy_version
     or new.policy is distinct from app.policy_json(v_policy) then
    raise exception 'Assessment used an out-of-date breeding policy' using errcode = 'check_violation';
  end if;
  select coalesce((select revision from public.pedigree_revisions where org_id = new.org_id), 0) into v_rev;
  if new.pedigree_revision > v_rev then
    raise exception 'Assessment refers to a pedigree revision that does not exist' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.memberships m
                  where m.org_id = new.org_id and m.user_id = new.requested_by and m.status = 'active') then
    raise exception 'Assessment requester is not a member of this organization' using errcode = '42501';
  end if;
  -- Classification must be at least as strict as the policy demands.
  if new.classification <> 'restricted' and (
       new.classified_coi >= v_policy.max_coi
       or new.relationships && v_policy.blocked_relationships) then
    raise exception 'Assessment classification is less strict than the policy requires' using errcode = 'check_violation';
  end if;
  if new.classification not in ('restricted', 'high') and new.classified_coi >= v_policy.high_band_min then
    raise exception 'Assessment classification is less strict than the policy requires' using errcode = 'check_violation';
  end if;
  if new.classification = 'low' and (new.classified_coi >= v_policy.low_band_max
       or new.completeness < v_policy.min_completeness) then
    raise exception 'Assessment classification is less strict than the policy requires' using errcode = 'check_violation';
  end if;
  if new.classification = 'elevated' and new.completeness < v_policy.min_completeness then
    raise exception 'Assessment classification is less strict than the policy requires' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger check_assessment before insert or update on public.breeding_assessments
  for each row execute function app.check_assessment();

create table public.assessment_overrides (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  assessment_id  uuid not null unique references public.breeding_assessments (id) on delete cascade,
  reason         text not null check (length(btrim(reason)) between 10 and 1000),
  approved_by    uuid not null default auth.uid(),
  approver_role  public.member_role not null,
  created_at     timestamptz not null default now()
);
comment on table public.assessment_overrides is 'Written reason an owner or manager gave for going ahead with a restricted pairing.';
create index assessment_overrides_org_idx on public.assessment_overrides (org_id);

-- -----------------------------------------------------------------------------
-- Matings
-- -----------------------------------------------------------------------------

create table public.mating_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  farm_id     uuid not null,
  dam_id      uuid not null,
  method      public.mating_method not null,
  started_on  date not null,
  ended_on    date,
  outcome     public.mating_outcome not null default 'awaiting_check',
  risk_acknowledged boolean not null default false,
  notes       text check (length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  version     integer not null default 1,
  row_seq     bigint not null default nextval('app.row_seq'),
  unique (id, org_id),
  foreign key (dam_id, org_id) references public.animals (id, org_id) on delete cascade,
  foreign key (farm_id, org_id) references public.farms (id, org_id),
  check (ended_on is null or (ended_on >= started_on and ended_on - started_on <= 120))
);
comment on table public.mating_events is 'A doe served or exposed to one or more bucks. Several bucks = uncertain paternity.';
create index mating_events_dam_idx on public.mating_events (dam_id, org_id, started_on desc);
create index mating_events_farm_idx on public.mating_events (farm_id, org_id);
create index mating_events_org_idx on public.mating_events (org_id, row_seq);

create table public.mating_event_sires (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  mating_id      uuid not null,
  sire_id        uuid not null,
  assessment_id  uuid not null references public.breeding_assessments (id),
  override_id    uuid references public.assessment_overrides (id),
  unique (mating_id, sire_id),
  foreign key (mating_id, org_id) references public.mating_events (id, org_id) on delete cascade,
  foreign key (sire_id, org_id) references public.animals (id, org_id) on delete cascade
);
create index mating_event_sires_mating_idx on public.mating_event_sires (mating_id, org_id);
create index mating_event_sires_sire_idx on public.mating_event_sires (sire_id, org_id);
create index mating_event_sires_assessment_idx on public.mating_event_sires (assessment_id);
create index mating_event_sires_override_idx on public.mating_event_sires (override_id);

-- -----------------------------------------------------------------------------
-- Pregnancy checks and births
-- -----------------------------------------------------------------------------

create table public.pregnancy_checks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  farm_id     uuid not null,
  dam_id      uuid not null,
  mating_id   uuid,
  checked_on  date not null,
  method      public.pregnancy_method not null,
  result      public.pregnancy_result not null,
  due_on      date,
  notes       text check (length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  version     integer not null default 1,
  row_seq     bigint not null default nextval('app.row_seq'),
  foreign key (dam_id, org_id) references public.animals (id, org_id) on delete cascade,
  foreign key (farm_id, org_id) references public.farms (id, org_id),
  foreign key (mating_id, org_id) references public.mating_events (id, org_id) on delete cascade,
  check (due_on is null or (result = 'pregnant' and due_on > checked_on))
);
comment on column public.pregnancy_checks.due_on is 'Due date estimated at the check (e.g. from a scan). Always an estimate.';
create index pregnancy_checks_dam_idx on public.pregnancy_checks (dam_id, org_id, checked_on desc);
create index pregnancy_checks_mating_idx on public.pregnancy_checks (mating_id, org_id);
create index pregnancy_checks_farm_idx on public.pregnancy_checks (farm_id, org_id);
create index pregnancy_checks_org_idx on public.pregnancy_checks (org_id, row_seq);

create table public.birth_events (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  farm_id          uuid not null,
  dam_id           uuid not null,
  mating_id        uuid,
  born_on          date not null,
  assisted         boolean not null default false,
  notes            text check (length(notes) <= 1000),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  version          integer not null default 1,
  row_seq          bigint not null default nextval('app.row_seq'),
  unique (id, org_id),
  foreign key (dam_id, org_id) references public.animals (id, org_id) on delete cascade,
  foreign key (farm_id, org_id) references public.farms (id, org_id),
  foreign key (mating_id, org_id) references public.mating_events (id, org_id) on delete cascade
);
comment on table public.birth_events is 'A kidding: one per mating at most.';
create unique index birth_events_mating_key on public.birth_events (mating_id) where mating_id is not null;
create index birth_events_dam_idx on public.birth_events (dam_id, org_id, born_on desc);
create index birth_events_farm_idx on public.birth_events (farm_id, org_id);
create index birth_events_mating_org_idx on public.birth_events (mating_id, org_id);
create index birth_events_org_idx on public.birth_events (org_id, row_seq);

create table public.birth_offspring (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  birth_id         uuid not null,
  position         smallint not null check (position between 1 and 8),
  animal_id        uuid unique,
  sex              public.animal_sex,
  born_alive       boolean not null,
  birth_weight_kg  numeric(4, 2) check (birth_weight_kg > 0 and birth_weight_kg < 20),
  unique (birth_id, position),
  foreign key (birth_id, org_id) references public.birth_events (id, org_id) on delete cascade,
  foreign key (animal_id, org_id) references public.animals (id, org_id) on delete set null (animal_id),
  check (not born_alive or animal_id is not null or sex is not null)
);
create index birth_offspring_birth_idx on public.birth_offspring (birth_id, org_id);
create index birth_offspring_animal_org_idx on public.birth_offspring (animal_id, org_id);

-- -----------------------------------------------------------------------------
-- Access helpers
-- -----------------------------------------------------------------------------

-- Can record matings, pregnancy checks and kiddings on this farm:
-- owners, assigned managers and workers, and assigned vets.
create function app.can_record_breeding(p_org uuid, p_farm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.can_work_farm(p_org, p_farm)
      or (app.org_role(p_org) = 'vet' and app.has_farm_access(p_org, p_farm));
$$;
revoke all on function app.can_record_breeding(uuid, uuid) from public, anon;
grant execute on function app.can_record_breeding(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Housekeeping triggers
-- -----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['breeding_policies', 'mating_events', 'pregnancy_checks', 'birth_events'] loop
    execute format('create trigger touch_row before update on public.%I for each row execute function app.touch_row()', t);
  end loop;
  foreach t in array array['breeding_policies', 'mating_events', 'mating_event_sires', 'assessment_overrides',
                           'pregnancy_checks', 'birth_events', 'birth_offspring', 'animal_candidate_sires'] loop
    execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function app.audit_row()', t);
  end loop;
end $$;

revoke all on function app.create_default_policy(), app.policy_change(), app.policy_json(public.breeding_policies),
  app.validate_candidate_sire(), app.candidate_sires_changed(), app.resolve_candidate_sires(),
  app.check_assessment() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.breeding_policies       enable row level security;
alter table public.animal_candidate_sires  enable row level security;
alter table public.breeding_assessments    enable row level security;
alter table public.assessment_overrides    enable row level security;
alter table public.mating_events           enable row level security;
alter table public.mating_event_sires      enable row level security;
alter table public.pregnancy_checks        enable row level security;
alter table public.birth_events            enable row level security;
alter table public.birth_offspring         enable row level security;

create policy breeding_policies_select on public.breeding_policies for select to authenticated
  using ((select app.is_org_member(org_id)));
create policy breeding_policies_update on public.breeding_policies for update to authenticated
  using ((select app.is_org_owner(org_id)))
  with check ((select app.is_org_owner(org_id)));

create policy animal_candidate_sires_select on public.animal_candidate_sires for select to authenticated
  using (exists (select 1 from public.animals a where a.id = child_id));

-- Visible when you can see both animals.
create policy breeding_assessments_select on public.breeding_assessments for select to authenticated
  using (exists (select 1 from public.animals a where a.id = buck_id)
     and exists (select 1 from public.animals a where a.id = doe_id));

create policy assessment_overrides_select on public.assessment_overrides for select to authenticated
  using (exists (select 1 from public.breeding_assessments a where a.id = assessment_id));

create policy mating_events_select on public.mating_events for select to authenticated
  using ((select app.has_farm_access(org_id, farm_id)));
create policy mating_event_sires_select on public.mating_event_sires for select to authenticated
  using (exists (select 1 from public.mating_events m where m.id = mating_id));

create policy pregnancy_checks_select on public.pregnancy_checks for select to authenticated
  using ((select app.has_farm_access(org_id, farm_id)));
create policy birth_events_select on public.birth_events for select to authenticated
  using ((select app.has_farm_access(org_id, farm_id)));
create policy birth_offspring_select on public.birth_offspring for select to authenticated
  using (exists (select 1 from public.birth_events b where b.id = birth_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------

revoke all on public.breeding_policies, public.animal_candidate_sires, public.breeding_assessments,
  public.assessment_overrides, public.mating_events, public.mating_event_sires, public.pregnancy_checks,
  public.birth_events, public.birth_offspring from anon, authenticated;

grant select on public.breeding_policies, public.animal_candidate_sires, public.breeding_assessments,
  public.assessment_overrides, public.mating_events, public.mating_event_sires, public.pregnancy_checks,
  public.birth_events, public.birth_offspring to authenticated;

grant update (low_band_max, high_band_min, max_coi, min_completeness, generations, blocked_relationships,
              allow_founder_assumption, advisor_name, advisor_note, advisor_confirmed_on)
  on public.breeding_policies to authenticated;

grant all on public.breeding_policies, public.animal_candidate_sires, public.breeding_assessments,
  public.assessment_overrides, public.mating_events, public.mating_event_sires, public.pregnancy_checks,
  public.birth_events, public.birth_offspring to service_role;

-- -----------------------------------------------------------------------------
-- Pedigree for the engine
-- -----------------------------------------------------------------------------

-- Everything the engine needs to assess pairings for the given animals (a doe,
-- optionally a buck), and optionally every eligible buck the caller can see.
-- Includes all ancestors and candidate sires, even on farms the caller cannot
-- see, so hidden ancestry still counts; those come without tag, name, dates
-- or breed. Raises if the caller cannot see a requested animal.
create function app.breeding_pedigree(p_animals uuid[], p_with_bucks boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org     uuid;
  v_species text;
  v_policy  public.breeding_policies%rowtype;
  v_roots   uuid[];
  v_bucks   uuid[] := '{}';
  v_out     jsonb;
begin
  if p_animals is null or cardinality(p_animals) not between 1 and 2 then
    raise exception 'Choose one or two animals' using errcode = '22023';
  end if;
  if (select count(*) from public.animals a
       where a.id = any(p_animals) and a.deleted_at is null and app.can_see_animal(a.org_id, a.farm_id))
     <> cardinality(array(select distinct unnest(p_animals))) then
    raise exception 'Animal not found' using errcode = 'P0002';
  end if;
  select min(a.org_id::text)::uuid, min(a.species_code) into v_org, v_species
    from public.animals a where a.id = any(p_animals);
  if (select count(distinct a.org_id) + count(distinct a.species_code) from public.animals a where a.id = any(p_animals)) <> 2 then
    raise exception 'Animals must be the same species in the same organization' using errcode = '22023';
  end if;

  select * into v_policy from public.breeding_policies where org_id = v_org and species_code = v_species;
  if not found then
    raise exception 'No breeding policy is set for this species' using errcode = 'P0002';
  end if;

  if p_with_bucks then
    select coalesce(array_agg(a.id order by a.id), '{}') into v_bucks
      from public.animals a
     where a.org_id = v_org and a.species_code = v_species and a.sex = 'male'
       and a.deleted_at is null and a.farm_id is not null
       and a.status not in ('sold', 'deceased', 'culled', 'quarantined')
       and app.has_farm_access(a.org_id, a.farm_id)
       and a.id <> all(p_animals);
  end if;
  v_roots := p_animals || v_bucks;

  with recursive edges(child, parent) as (
    select p.child_id, p.parent_id from public.animal_parentage p where p.org_id = v_org and p.is_current
    union all
    select c.child_id, c.sire_id from public.animal_candidate_sires c where c.org_id = v_org
  ),
  closure(id) as (
    select unnest(v_roots)
    union
    select e.parent from edges e join closure on e.child = closure.id
  )
  select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'sex', a.sex,
      'speciesId', a.species_code,
      'visible', vis.ok,
      'label', case when vis.ok then app.animal_label(a.id) end,
      'breedId', case when vis.ok then a.breed_id end,
      'birthDate', case when vis.ok then a.birth_date end,
      'birthDateEstimated', a.birth_date_estimated,
      'sireId', s.parent_id,
      'sireConfidence', s.confidence,
      'damId', d.parent_id,
      'damConfidence', d.confidence,
      'candidateSireIds', coalesce((select jsonb_agg(c.sire_id order by c.sire_id)
                                      from public.animal_candidate_sires c where c.child_id = a.id), '[]'::jsonb),
      'isDeclaredFounder', a.is_declared_founder,
      'status', case when vis.ok then a.status end,
      'ownership', case when a.origin = 'pedigree_only' then 'external_reference'
                        when a.status = 'sold' then 'sold' else 'owned' end
    ) order by a.id)
    into v_out
    from closure cl
    join public.animals a on a.id = cl.id
    cross join lateral (select app.can_see_animal(a.org_id, a.farm_id) as ok) vis
    left join public.animal_parentage s on s.child_id = a.id and s.role = 'sire' and s.is_current
    left join public.animal_parentage d on d.child_id = a.id and d.role = 'dam' and d.is_current;

  return jsonb_build_object(
    'orgId', v_org,
    'speciesId', v_species,
    'revision', coalesce((select revision from public.pedigree_revisions where org_id = v_org), 0),
    'policy', app.policy_json(v_policy),
    'policyVersion', v_policy.version,
    'gestationDays', (select gestation_days from public.species where code = v_species),
    'bucks', to_jsonb(v_bucks),
    'animals', coalesce(v_out, '[]'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- Record a mating
-- -----------------------------------------------------------------------------

-- p_sires: [{"sire_id": uuid, "assessment_id": uuid}, ...]
create function app.record_mating(
  p_dam               uuid,
  p_method            public.mating_method,
  p_started_on        date,
  p_ended_on          date,
  p_sires             jsonb,
  p_override_reason   text default null,
  p_risk_acknowledged boolean default false,
  p_notes             text default null,
  p_id                uuid default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_dam      public.animals%rowtype;
  v_sire     public.animals%rowtype;
  v_ass      public.breeding_assessments%rowtype;
  v_policy   public.breeding_policies%rowtype;
  v_rev      bigint;
  v_id       uuid := coalesce(p_id, gen_random_uuid());
  v_item     jsonb;
  v_override uuid;
  v_any_restricted boolean := false;
  v_any_warning    boolean := false;
  v_names    text[] := '{}';
  v_method   text := case p_method when 'pasture' then 'running with the herd' when 'hand' then 'hand mating' else 'AI' end;
begin
  select * into v_dam from public.animals where id = p_dam and deleted_at is null;
  if not found or not app.can_see_animal(v_dam.org_id, v_dam.farm_id) then
    raise exception 'Animal not found' using errcode = 'P0002';
  end if;
  if v_dam.farm_id is null then
    raise exception '% is a records-only ancestor, not on a farm', app.animal_label(p_dam) using errcode = 'check_violation';
  end if;
  if not app.can_record_breeding(v_dam.org_id, v_dam.farm_id) then
    raise exception 'You don''t have permission to record breeding on this farm' using errcode = '42501';
  end if;
  if v_dam.sex <> 'female' then
    raise exception '% is not a doe', app.animal_label(p_dam) using errcode = 'check_violation';
  end if;
  if v_dam.status in ('sold', 'deceased', 'culled') then
    raise exception '% is %', app.animal_label(p_dam), v_dam.status using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.mating_events where dam_id = p_dam and outcome = 'pregnant') then
    raise exception '% is recorded as pregnant. Record a pregnancy check or the kidding first.', app.animal_label(p_dam)
      using errcode = 'check_violation';
  end if;
  if p_started_on is null or p_started_on > current_date then
    raise exception 'The mating date cannot be in the future' using errcode = 'check_violation';
  end if;
  if v_dam.birth_date is not null and p_started_on <= v_dam.birth_date then
    raise exception 'The mating date is before % was born', app.animal_label(p_dam) using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_sires) <> 'array' or jsonb_array_length(p_sires) not between 1 and 10 then
    raise exception 'Choose between 1 and 10 bucks' using errcode = '22023';
  end if;
  if (select count(distinct e ->> 'sire_id') from jsonb_array_elements(p_sires) e) <> jsonb_array_length(p_sires) then
    raise exception 'Each buck can be listed only once' using errcode = '22023';
  end if;
  if p_method <> 'pasture' and jsonb_array_length(p_sires) > 1 then
    raise exception 'Hand mating and AI use one buck. Use "running with the herd" for several bucks.' using errcode = '22023';
  end if;

  select * into v_policy from public.breeding_policies where org_id = v_dam.org_id and species_code = v_dam.species_code;
  select coalesce((select revision from public.pedigree_revisions where org_id = v_dam.org_id), 0) into v_rev;

  insert into public.mating_events (id, org_id, farm_id, dam_id, method, started_on, ended_on, notes)
  values (v_id, v_dam.org_id, v_dam.farm_id, p_dam, p_method, p_started_on, p_ended_on, nullif(btrim(p_notes), ''));

  for v_item in select * from jsonb_array_elements(p_sires) loop
    select * into v_sire from public.animals
     where id = (v_item ->> 'sire_id')::uuid and org_id = v_dam.org_id and deleted_at is null;
    if not found or not app.can_see_animal(v_sire.org_id, v_sire.farm_id) then
      raise exception 'Buck not found' using errcode = 'P0002';
    end if;
    if v_sire.sex <> 'male' or v_sire.species_code <> v_dam.species_code then
      raise exception '% is not a buck of the same species', app.animal_label(v_sire.id) using errcode = 'check_violation';
    end if;
    if v_sire.status in ('sold', 'deceased', 'culled', 'quarantined') then
      raise exception '% is %', app.animal_label(v_sire.id), v_sire.status using errcode = 'check_violation';
    end if;
    if v_sire.farm_id is null and p_method <> 'ai' then
      raise exception '% is a records-only animal; only AI can use it', app.animal_label(v_sire.id) using errcode = 'check_violation';
    end if;

    select * into v_ass from public.breeding_assessments where id = (v_item ->> 'assessment_id')::uuid;
    if not found or v_ass.org_id <> v_dam.org_id or v_ass.buck_id <> v_sire.id or v_ass.doe_id <> p_dam then
      raise exception 'Run the breeding check for % and % first', app.animal_label(v_sire.id), app.animal_label(p_dam)
        using errcode = 'check_violation';
    end if;
    if v_ass.requested_by <> auth.uid() or v_ass.created_at < now() - interval '1 day'
       or v_ass.pedigree_revision <> v_rev or v_ass.policy_id <> v_policy.id or v_ass.policy_version <> v_policy.version then
      raise exception 'The breeding check for % is out of date. Run it again.', app.animal_label(v_sire.id)
        using errcode = 'check_violation';
    end if;

    v_override := null;
    if v_ass.classification = 'restricted' then
      v_any_restricted := true;
      if not app.can_manage_farm(v_dam.org_id, v_dam.farm_id) then
        raise exception 'This pairing is restricted by the farm''s breeding policy. Only an owner or a manager of this farm can approve it.'
          using errcode = '42501';
      end if;
      if p_override_reason is null or length(btrim(p_override_reason)) < 10 then
        raise exception 'Give a reason of at least 10 characters for going ahead with a restricted pairing'
          using errcode = 'check_violation';
      end if;
      insert into public.assessment_overrides (org_id, assessment_id, reason, approver_role)
      values (v_dam.org_id, v_ass.id, btrim(p_override_reason), app.org_role(v_dam.org_id))
      on conflict (assessment_id) do nothing
      returning id into v_override;
      if v_override is null then
        raise exception 'That breeding check was already used. Run it again.' using errcode = 'check_violation';
      end if;
    end if;
    if v_ass.classification in ('restricted', 'high', 'insufficient') then
      v_any_warning := true;
    end if;

    insert into public.mating_event_sires (org_id, mating_id, sire_id, assessment_id, override_id)
    values (v_dam.org_id, v_id, v_sire.id, v_ass.id, v_override);
    v_names := v_names || app.animal_label(v_sire.id);
    perform app.add_event(v_dam.org_id, v_sire.id, 'mating',
      format('Mated with %s (%s)', app.animal_label(p_dam), v_method),
      jsonb_build_object('mating_id', v_id, 'dam_id', p_dam));
  end loop;

  if v_any_warning and not coalesce(p_risk_acknowledged, false) then
    raise exception 'Confirm that you have read the breeding check warning' using errcode = 'check_violation';
  end if;
  update public.mating_events set risk_acknowledged = v_any_warning where id = v_id;

  perform app.add_event(v_dam.org_id, p_dam, 'mating',
    format('Mated with %s (%s)%s', array_to_string(v_names, ', '), v_method,
           case when v_any_restricted then ', restricted pairing approved with a reason' else '' end),
    jsonb_build_object('mating_id', v_id));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Record a pregnancy check
-- -----------------------------------------------------------------------------

create function app.record_pregnancy_check(
  p_dam        uuid,
  p_mating     uuid,
  p_checked_on date,
  p_method     public.pregnancy_method,
  p_result     public.pregnancy_result,
  p_due_on     date default null,
  p_notes      text default null,
  p_id         uuid default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_dam    public.animals%rowtype;
  v_mating public.mating_events%rowtype;
  v_id     uuid := coalesce(p_id, gen_random_uuid());
begin
  select * into v_dam from public.animals where id = p_dam and deleted_at is null;
  if not found or not app.can_see_animal(v_dam.org_id, v_dam.farm_id) then
    raise exception 'Animal not found' using errcode = 'P0002';
  end if;
  if v_dam.farm_id is null or not app.can_record_breeding(v_dam.org_id, v_dam.farm_id) then
    raise exception 'You don''t have permission to record breeding on this farm' using errcode = '42501';
  end if;
  if v_dam.sex <> 'female' then
    raise exception '% is not a doe', app.animal_label(p_dam) using errcode = 'check_violation';
  end if;
  if p_checked_on is null or p_checked_on > current_date then
    raise exception 'The check date cannot be in the future' using errcode = 'check_violation';
  end if;
  if p_mating is not null then
    select * into v_mating from public.mating_events where id = p_mating and dam_id = p_dam;
    if not found then
      raise exception 'That mating is not for %', app.animal_label(p_dam) using errcode = 'check_violation';
    end if;
    if v_mating.outcome = 'kidded' then
      raise exception 'That mating already has a kidding recorded' using errcode = 'check_violation';
    end if;
    if p_checked_on < v_mating.started_on then
      raise exception 'The check date is before the mating' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.pregnancy_checks (id, org_id, farm_id, dam_id, mating_id, checked_on, method, result, due_on, notes)
  values (v_id, v_dam.org_id, v_dam.farm_id, p_dam, p_mating, p_checked_on, p_method, p_result,
          case when p_result = 'pregnant' then p_due_on end, nullif(btrim(p_notes), ''));

  if p_mating is not null and p_result <> 'unsure' then
    update public.mating_events
       set outcome = case p_result when 'pregnant' then 'pregnant'::public.mating_outcome else 'not_pregnant' end
     where id = p_mating;
  end if;
  if p_result = 'pregnant' and v_dam.status in ('active', 'breeding', 'growing', 'nursing') then
    update public.animals set status = 'pregnant' where id = p_dam;
  elsif p_result = 'not_pregnant' and v_dam.status = 'pregnant' then
    update public.animals set status = 'active' where id = p_dam;
  end if;

  perform app.add_event(v_dam.org_id, p_dam, 'pregnancy_check',
    format('Pregnancy check (%s): %s',
      case p_method when 'ultrasound' then 'scan' when 'blood_test' then 'blood test' else 'observation' end,
      case p_result when 'pregnant' then 'pregnant' when 'not_pregnant' then 'not pregnant' else 'unsure' end),
    jsonb_build_object('check_id', v_id, 'mating_id', p_mating));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Register a kidding
-- -----------------------------------------------------------------------------

-- p_kids: [{"alive": bool, "sex": "male"|"female"|null, "tag": text, "name": text, "weight_kg": number}, ...]
-- Sire: from the mating when it had one buck; when it had several, the kids get
-- them as candidate sires unless p_sire names one of them. Without a mating,
-- p_sire is optional.
create function app.register_birth(
  p_dam             uuid,
  p_mating          uuid,
  p_born_on         date,
  p_kids            jsonb,
  p_breed           uuid default null,
  p_sire            uuid default null,
  p_sire_confidence public.parent_confidence default 'observed',
  p_dam_confidence  public.parent_confidence default 'observed',
  p_assisted        boolean default false,
  p_notes           text default null,
  p_id              uuid default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_dam        public.animals%rowtype;
  v_mating     public.mating_events%rowtype;
  v_id         uuid := coalesce(p_id, gen_random_uuid());
  v_candidates uuid[] := '{}';
  v_sire       uuid := p_sire;
  v_kid        jsonb;
  v_pos        int := 0;
  v_animal     uuid;
  v_alive      int := 0;
  v_dead       int := 0;
  v_bucks      int := 0;
  v_does       int := 0;
  v_c          uuid;
begin
  select * into v_dam from public.animals where id = p_dam and deleted_at is null;
  if not found or not app.can_see_animal(v_dam.org_id, v_dam.farm_id) then
    raise exception 'Animal not found' using errcode = 'P0002';
  end if;
  if v_dam.farm_id is null or not app.can_record_breeding(v_dam.org_id, v_dam.farm_id) then
    raise exception 'You don''t have permission to record breeding on this farm' using errcode = '42501';
  end if;
  if v_dam.sex <> 'female' then
    raise exception '% is not a doe', app.animal_label(p_dam) using errcode = 'check_violation';
  end if;
  if p_born_on is null or p_born_on > current_date then
    raise exception 'The kidding date cannot be in the future' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_kids) <> 'array' or jsonb_array_length(p_kids) not between 1 and 8 then
    raise exception 'Record between 1 and 8 kids' using errcode = '22023';
  end if;
  if p_breed is not null and not exists (
       select 1 from public.breeds b where b.id = p_breed and b.species_code = v_dam.species_code
          and (b.org_id is null or b.org_id = v_dam.org_id)) then
    raise exception 'Breed not found' using errcode = 'P0002';
  end if;

  if p_mating is not null then
    select * into v_mating from public.mating_events where id = p_mating and dam_id = p_dam;
    if not found then
      raise exception 'That mating is not for %', app.animal_label(p_dam) using errcode = 'check_violation';
    end if;
    if v_mating.outcome = 'kidded' then
      raise exception 'That mating already has a kidding recorded' using errcode = 'check_violation';
    end if;
    if p_born_on <= v_mating.started_on then
      raise exception 'The kidding date must be after the mating' using errcode = 'check_violation';
    end if;
    select array_agg(sire_id order by sire_id) into v_candidates from public.mating_event_sires where mating_id = p_mating;
    if cardinality(v_candidates) = 1 then
      if v_sire is not null and v_sire <> v_candidates[1] then
        raise exception 'The sire must be the buck recorded for the mating' using errcode = 'check_violation';
      end if;
      v_sire := v_candidates[1];
      v_candidates := '{}';
    elsif v_sire is not null then
      if not v_sire = any(v_candidates) then
        raise exception 'The sire must be one of the bucks recorded for the mating' using errcode = 'check_violation';
      end if;
      v_candidates := '{}';
    end if;
  elsif v_sire is not null then
    if not exists (select 1 from public.animals a where a.id = v_sire and a.org_id = v_dam.org_id
                     and a.deleted_at is null and app.can_see_animal(a.org_id, a.farm_id)) then
      raise exception 'Buck not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.birth_events (id, org_id, farm_id, dam_id, mating_id, born_on, assisted, notes)
  values (v_id, v_dam.org_id, v_dam.farm_id, p_dam, p_mating, p_born_on, coalesce(p_assisted, false), nullif(btrim(p_notes), ''));

  for v_kid in select * from jsonb_array_elements(p_kids) loop
    v_pos := v_pos + 1;
    v_animal := null;
    if coalesce((v_kid ->> 'alive')::boolean, true) then
      if (v_kid ->> 'sex') is null then
        raise exception 'Choose buck or doe for kid %', v_pos using errcode = 'check_violation';
      end if;
      if nullif(btrim(v_kid ->> 'tag'), '') is null and nullif(btrim(v_kid ->> 'name'), '') is null then
        raise exception 'Give kid % a tag or a name', v_pos using errcode = 'check_violation';
      end if;
      insert into public.animals (org_id, farm_id, pen_id, species_code, breed_id, tag, name, sex,
                                  birth_date, status, origin)
      values (v_dam.org_id, v_dam.farm_id, v_dam.pen_id, v_dam.species_code, p_breed,
              nullif(btrim(v_kid ->> 'tag'), ''), nullif(btrim(v_kid ->> 'name'), ''),
              (v_kid ->> 'sex')::public.animal_sex, p_born_on, 'growing', 'born_on_farm')
      returning id into v_animal;
      insert into public.animal_parentage (org_id, child_id, parent_id, role, confidence, evidence)
      values (v_dam.org_id, v_animal, p_dam, 'dam', p_dam_confidence, 'Kidding record');
      if v_sire is not null then
        insert into public.animal_parentage (org_id, child_id, parent_id, role, confidence, evidence)
        values (v_dam.org_id, v_animal, v_sire, 'sire', p_sire_confidence,
                case when p_mating is not null then 'Mating record' else 'Kidding record' end);
      else
        foreach v_c in array v_candidates loop
          insert into public.animal_candidate_sires (org_id, child_id, sire_id) values (v_dam.org_id, v_animal, v_c);
        end loop;
      end if;
      v_alive := v_alive + 1;
      if (v_kid ->> 'sex') = 'male' then v_bucks := v_bucks + 1; else v_does := v_does + 1; end if;
    else
      v_dead := v_dead + 1;
    end if;
    insert into public.birth_offspring (org_id, birth_id, position, animal_id, sex, born_alive, birth_weight_kg)
    values (v_dam.org_id, v_id, v_pos, v_animal, (v_kid ->> 'sex')::public.animal_sex,
            coalesce((v_kid ->> 'alive')::boolean, true), (v_kid ->> 'weight_kg')::numeric);
  end loop;

  if p_mating is not null then
    update public.mating_events set outcome = 'kidded' where id = p_mating;
  end if;
  if v_alive > 0 and v_dam.status not in ('sold', 'deceased', 'culled') then
    update public.animals set status = 'nursing' where id = p_dam and status <> 'nursing';
  elsif v_dam.status = 'pregnant' then
    update public.animals set status = 'active' where id = p_dam;
  end if;

  perform app.add_event(v_dam.org_id, p_dam, 'kidding',
    format('Kidded: %s', concat_ws(', ',
      case when v_alive > 0 then format('%s live kid%s (%s buck%s, %s doe%s)', v_alive, case when v_alive = 1 then '' else 's' end,
                                        v_bucks, case when v_bucks = 1 then '' else 's' end, v_does, case when v_does = 1 then '' else 's' end) end,
      case when v_dead > 0 then format('%s stillborn', v_dead) end)),
    jsonb_build_object('birth_id', v_id));
  return v_id;
end;
$$;

revoke all on function app.breeding_pedigree(uuid[], boolean),
  app.record_mating(uuid, public.mating_method, date, date, jsonb, text, boolean, text, uuid),
  app.record_pregnancy_check(uuid, uuid, date, public.pregnancy_method, public.pregnancy_result, date, text, uuid),
  app.register_birth(uuid, uuid, date, jsonb, uuid, uuid, public.parent_confidence, public.parent_confidence, boolean, text, uuid)
  from public, anon;
grant execute on function app.breeding_pedigree(uuid[], boolean),
  app.record_mating(uuid, public.mating_method, date, date, jsonb, text, boolean, text, uuid),
  app.record_pregnancy_check(uuid, uuid, date, public.pregnancy_method, public.pregnancy_result, date, text, uuid),
  app.register_birth(uuid, uuid, date, jsonb, uuid, uuid, public.parent_confidence, public.parent_confidence, boolean, text, uuid)
  to authenticated;

-- Public wrappers (SECURITY INVOKER) so the API exposes only these entry points.
create function public.breeding_pedigree(p_animals uuid[], p_with_bucks boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$
  select app.breeding_pedigree(p_animals, p_with_bucks);
$$;

create function public.record_mating(
  p_dam uuid, p_method public.mating_method, p_started_on date, p_ended_on date, p_sires jsonb,
  p_override_reason text default null, p_risk_acknowledged boolean default false,
  p_notes text default null, p_id uuid default null)
returns uuid language sql security invoker set search_path = '' as $$
  select app.record_mating(p_dam, p_method, p_started_on, p_ended_on, p_sires, p_override_reason,
                           p_risk_acknowledged, p_notes, p_id);
$$;

create function public.record_pregnancy_check(
  p_dam uuid, p_mating uuid, p_checked_on date, p_method public.pregnancy_method,
  p_result public.pregnancy_result, p_due_on date default null, p_notes text default null, p_id uuid default null)
returns uuid language sql security invoker set search_path = '' as $$
  select app.record_pregnancy_check(p_dam, p_mating, p_checked_on, p_method, p_result, p_due_on, p_notes, p_id);
$$;

create function public.register_birth(
  p_dam uuid, p_mating uuid, p_born_on date, p_kids jsonb, p_breed uuid default null,
  p_sire uuid default null, p_sire_confidence public.parent_confidence default 'observed',
  p_dam_confidence public.parent_confidence default 'observed', p_assisted boolean default false,
  p_notes text default null, p_id uuid default null)
returns uuid language sql security invoker set search_path = '' as $$
  select app.register_birth(p_dam, p_mating, p_born_on, p_kids, p_breed, p_sire, p_sire_confidence,
                            p_dam_confidence, p_assisted, p_notes, p_id);
$$;

revoke all on function public.breeding_pedigree(uuid[], boolean),
  public.record_mating(uuid, public.mating_method, date, date, jsonb, text, boolean, text, uuid),
  public.record_pregnancy_check(uuid, uuid, date, public.pregnancy_method, public.pregnancy_result, date, text, uuid),
  public.register_birth(uuid, uuid, date, jsonb, uuid, uuid, public.parent_confidence, public.parent_confidence, boolean, text, uuid)
  from public, anon;
grant execute on function public.breeding_pedigree(uuid[], boolean),
  public.record_mating(uuid, public.mating_method, date, date, jsonb, text, boolean, text, uuid),
  public.record_pregnancy_check(uuid, uuid, date, public.pregnancy_method, public.pregnancy_result, date, text, uuid),
  public.register_birth(uuid, uuid, date, jsonb, uuid, uuid, public.parent_confidence, public.parent_confidence, boolean, text, uuid)
  to authenticated;
