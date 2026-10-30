-- =============================================================================
-- Herd Intelligence · M1 · Email on profiles
--
-- The team screen needs each member's email, which lives in auth.users (not
-- readable by clients). Copy it to profiles and keep it in sync. Visibility is
-- unchanged: you see your own profile and those of people in your organizations.
-- Clients still cannot write it (the column is not in the update grant).
-- =============================================================================

alter table public.profiles add column email text check (length(email) <= 320);

update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id;

create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 120),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create function app.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke all on function app.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function app.sync_profile_email();
