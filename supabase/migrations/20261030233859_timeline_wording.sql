-- =============================================================================
-- Herd Intelligence · M3 · Clearer timeline wording
--
-- Animal labels match the app ("D-001 · Amina" rather than "D-001 (Amina)"),
-- and confidence is written in words ("seen or documented" rather than
-- "observed"), so entries no longer read "D-001 (Amina) (observed)".
-- =============================================================================

create or replace function app.animal_label(p_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(concat_ws(' · ', a.tag, a.name), ''), a.registration_number, 'animal')
    from public.animals a where a.id = p_id;
$$;

create function app.confidence_words(p public.parent_confidence) returns text
language sql immutable set search_path = '' as $$
  select case p
    when 'dna' then 'DNA confirmed'
    when 'observed' then 'seen or documented'
    when 'reported' then 'reported by previous owner'
    else 'assumed'
  end;
$$;
revoke all on function app.confidence_words(public.parent_confidence) from public, anon, authenticated;

create or replace function app.parentage_timeline() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_word text := case new.role when 'sire' then 'Sire' else 'Dam' end;
begin
  if tg_op = 'INSERT' and new.is_current then
    perform app.add_event(new.org_id, new.child_id, 'parent_set',
      format('%s recorded: %s (%s)', v_word, app.animal_label(new.parent_id), app.confidence_words(new.confidence)),
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
      format('%s confidence changed from %s to %s', v_word,
             app.confidence_words(old.confidence), app.confidence_words(new.confidence)));
  end if;
  perform app.bump_pedigree_revision(new.org_id);
  return null;
end;
$$;
