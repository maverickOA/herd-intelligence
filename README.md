# Herd Intelligence

Livestock management and breeding intelligence platform. Green Summit Farms is the first tenant. The design is in the *Herd Intelligence — Phase 1 Technical Plan* doc.

## What's built so far

| Milestone | Status | Where |
| --- | --- | --- |
| M2 Pedigree engine | Done: 31 tests, 10,000 random pedigrees cross-checked | `packages/pedigree-engine` |
| M1 Tenancy and access (database) | Done: 36 security tests; live on Supabase; advisors clean | `supabase/migrations`, `packages/db-tests` |
| M1 Sign-in and onboarding screens | Next | — |

## Repository layout

```
packages/
  pedigree-engine/   COI, Wright paths, completeness, classification (pure TypeScript)
  db-tests/          runs every migration on a throwaway local Postgres and tests RLS
supabase/
  config.toml        Supabase CLI project config (Postgres 17)
  migrations/        schema, Row Level Security, RPCs
```

## Run the tests

```bash
npm install
npm test             # both suites (also run by GitHub Actions on every push)
npm run test:engine  # pedigree engine only
npm run test:db      # database security only (downloads a local Postgres 17 the first time)
```

No Supabase account or Docker is needed for the tests: `db-tests` starts its own Postgres and applies a small stand-in for Supabase's `auth` schema (`packages/db-tests/sql/local-supabase-shim.sql`) before the migrations.

## The M1 database

**Tables:** `organizations`, `profiles`, `platform_admins`, `memberships`, `farm_assignments`, `farms`, `pens`, `invitations`, `audit_log`.

**Roles:** owner (whole organization), manager (assigned farms: edit farm details and pens), worker and vet (see assigned farms; field-record rules arrive with the herd tables in M3).

**How isolation works**

- RLS is on for every table, with policies scoped to the signed-in user. Access helpers live in a private `app` schema the API does not expose.
- Composite foreign keys (`farm_id, org_id`) make it impossible for a pen or assignment to point at another organization's farm, even for an admin.
- Clients get column-level grants only, so they can never write `org_id`, `version`, `row_seq` or audit columns. Triggers maintain those.
- Organizations, memberships and invitations are created only through RPCs: `create_organization`, `create_invitation` (returns the token once; only its SHA-256 is stored) and `accept_invitation` (must be signed in with the invited email).
- An organization can never lose its last owner. Every change is written to `audit_log`, readable by owners.
- Every row has `version` and `row_seq` for offline sync, and accepts device-generated UUIDs.

**Two migrations:** `tenancy_and_access` (the schema) and `advisor_fixes` (covering indexes for the composite tenant keys; privileged functions moved to the private `app` schema behind public wrappers).

**What the tests prove:** another organization's rows can't be read, changed or created by id; workers, vets and managers see only their farms; workers can't promote themselves; suspended members lose access at once; invitations work only for the right email, once, before expiry; anonymous callers see nothing. Four deliberate security bugs were introduced during development and each was caught.

## Supabase project

- Project `herd-intelligence` (ref `rqhhhjlcoavcsqtfnbzx`), Postgres 17, region eu-west-1.
- Both migrations are applied; local file names match the remote migration versions.
- Security advisor: no findings. Performance advisor: only "unused index" notes, expected while the database is empty.
- A live isolation check (two throwaway users in a rolled-back transaction) confirmed profiles are created at sign-up, one organization cannot see or write into another, and anonymous requests are refused.

To work with it from your own computer: `npx supabase login`, `npx supabase link --project-ref rqhhhjlcoavcsqtfnbzx`, then `npx supabase db push` for new migrations.

Keep the service-role key out of the browser and out of Git; only the publishable key goes in `NEXT_PUBLIC_*` variables.
