# Herd Intelligence

Livestock management and breeding intelligence platform. Green Summit Farms is the first tenant. The design is in the *Herd Intelligence — Phase 1 Technical Plan* doc.

## What's built so far

| Milestone | Status | Where |
| --- | --- | --- |
| M2 Pedigree engine | Done: 31 tests, 10,000 random pedigrees cross-checked | `packages/pedigree-engine` |
| M1 Tenancy and access (database) | Done: 37 security tests; live on Supabase | `supabase/migrations`, `packages/db-tests` |
| M1 Web app: sign-in, onboarding, farms, pens, team, settings | Done: end-to-end tested against the live project | `apps/web` |
| Deployment (Vercel) | Next | — |

## Repository layout

```
apps/
  web/               Next.js 16 app (App Router, Supabase SSR auth, shadcn/ui)
    e2e/smoke.mjs    end-to-end browser test
packages/
  pedigree-engine/   COI, Wright paths, completeness, classification (pure TypeScript)
  db-tests/          runs every migration on a throwaway local Postgres and tests RLS
supabase/
  config.toml        Supabase CLI project config (Postgres 17)
  migrations/        schema, Row Level Security, RPCs
```

## Run the app locally

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # then fill in the Supabase URL and publishable key
npm run dev                                     # http://localhost:3000
```

The publishable key is safe in the browser. Never put the service-role or secret key in a `NEXT_PUBLIC_*` variable or in Git.

## Run the tests

```bash
npm test             # engine + database (GitHub Actions also lints, type-checks and builds the web app)
npm run test:engine  # pedigree engine only
npm run test:db      # database security only (downloads a local Postgres 17 the first time)
```

No Supabase account or Docker is needed for these: `db-tests` starts its own Postgres and applies a small stand-in for Supabase's `auth` schema (`packages/db-tests/sql/local-supabase-shim.sql`).

**End-to-end:** with the app running (`npm run build -w web && npm start -w web`) and three confirmed accounts in the target project, run `E2E_PASSWORD=... node apps/web/e2e/smoke.mjs`. See the header of that file for options. It covers sign-in, onboarding, pens, farms, invitations, worker restrictions, tenant isolation by URL, pausing and restoring access, and sign-out, on a phone-sized and a desktop screen.

## The web app (M1)

- **Auth:** email and password sign-up with email confirmation, sign-in, password reset, sign-out. Sessions are refreshed in `proxy.ts`; pages check the user with `getClaims()`.
- **Onboarding:** create an organization and its first farm; you become the owner.
- **Farms and pens:** owners add farms; owners and assigned managers edit farm details and add, edit and archive pens.
- **Team:** owners invite by email and role, choose farm access, and get a one-time link to share by WhatsApp, SMS or email. Owners change roles and farm access, pause or restore access, and remove people; anyone can leave.
- **Settings:** your name and phone; organization name, country, currency and time zone (owners).
- **Navigation:** bottom tabs on phones, sidebar on desktop. Only working screens appear; Herd, Breeding and Tasks join as those milestones ship.
- Every action runs as the signed-in user, so the database's Row Level Security has the final say. Cache Components is off on purpose so tenant data is never cached on the server.

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

**Migrations:** `tenancy_and_access` (schema), `advisor_fixes` (covering indexes; privileged functions behind public wrappers), `profile_email` (email on profiles for the team list), `paused_member_profiles` (owners still see paused members' names).

## Supabase project

- Project `herd-intelligence` (ref `rqhhhjlcoavcsqtfnbzx`), Postgres 17, region eu-west-1. All four migrations applied; local file names match the remote versions.
- Security advisor: one setting to switch on, leaked-password protection (Authentication settings). Performance advisor: only "unused index" notes.

**Auth settings to set in the dashboard (Authentication → URL Configuration):**
- Site URL: the app's public address once deployed (for now `http://localhost:3000`).
- Redirect URLs: add `http://localhost:3000/**` and, later, the deployed address with `/**`.
- Optional but recommended: in the email templates, point links at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}` (and `type=recovery` for password reset), so links work even when opened on a different device. `/auth/confirm` supports both this and the default link style.
- Supabase's built-in email sender is rate-limited; add a custom SMTP provider before inviting many people.

To work with the database from your own computer: `npx supabase login`, `npx supabase link --project-ref rqhhhjlcoavcsqtfnbzx`, then `npx supabase db push` for new migrations.
