# Herd Intelligence

Livestock management and breeding intelligence platform. Green Summit Farms is the first tenant. The design is in the *Herd Intelligence — Phase 1 Technical Plan* doc.

## What's built so far

| Milestone | Status | Where |
| --- | --- | --- |
| M2 Pedigree engine | Done: 31 tests, 10,000 random pedigrees cross-checked | `packages/pedigree-engine` |
| M1 Tenancy and access (database) | Done: 37 security tests; live on Supabase | `supabase/migrations`, `packages/db-tests` |
| M1 Web app: sign-in, onboarding, farms, pens, team, settings | Done: end-to-end tested against the live project | `apps/web` |
| Deployment | Done: Netlify, redeploys on every push to `main` | https://herd-intelligence.netlify.app |
| M3 Herd registry and pedigrees | Done: 23 database tests, browser-tested | `apps/web/app/o/[orgId]/herd` |
| M4 Breeding checks, matings, pregnancy checks, kidding | Done: 27 database tests, browser-tested; engine runs in a Supabase Edge Function | `apps/web/app/o/[orgId]/breeding`, `packages/breeding-service`, `supabase/functions/breeding` |
| M5 Offline use and sync | Next | — |

## Repository layout

```
apps/
  web/               Next.js 16 app (App Router, Supabase SSR auth, shadcn/ui)
    e2e/smoke.mjs    end-to-end browser test (M1)
    e2e/herd.mjs     end-to-end browser test (M3)
    e2e/breeding.mjs end-to-end browser test (M4)
packages/
  pedigree-engine/   COI, Wright paths, completeness, classification (pure TypeScript)
  breeding-service/  runs the engine on the database's pedigree snapshot; bundled into the Edge Function
  db-tests/          runs every migration on a throwaway local Postgres and tests RLS
supabase/
  config.toml        Supabase CLI project config (Postgres 17)
  migrations/        schema, Row Level Security, RPCs
  functions/breeding Edge Function: the only writer of breeding assessments
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
npm test             # engine + breeding service + database (GitHub Actions also lints, type-checks and builds the web app)
npm run test:engine  # pedigree engine only
npm run test:breeding  # breeding service only
npm run test:db      # database security only (downloads a local Postgres 17 the first time)
```

No Supabase account or Docker is needed for these: `db-tests` starts its own Postgres and applies a small stand-in for Supabase's `auth` schema (`packages/db-tests/sql/local-supabase-shim.sql`).

**End-to-end:** with the app running (`npm run build -w web && npm start -w web`) and three confirmed accounts in the target project, run `E2E_PASSWORD=... node apps/web/e2e/smoke.mjs`. See the header of that file for options. It covers sign-in, onboarding, pens, farms, invitations, worker restrictions, tenant isolation by URL, pausing and restoring access, and sign-out, on a phone-sized and a desktop screen.

## Breeding (M4)

- **Check a pairing:** expected kid COI from every recorded ancestor (exact fraction), the same figure using only DNA-confirmed or seen parent links, the worst case when a sire is uncertain, pedigree completeness, the named relationship, each shared ancestor and path, and what the check can't see. Results read *Low known pedigree risk*, *Elevated*, *Insufficient pedigree information*, *High* or *Restricted by farm breeding policy*, never "safe". Missing pedigree is never rated low.
- **Full ancestry, even across farms:** the database hands the engine every ancestor, including those on farms the user can't see, so hidden relatives still count. Those animals appear only as "an animal on a farm you can't see".
- **Can't be forged:** checks run in the Supabase Edge Function `breeding`, which alone can write `breeding_assessments`. A database trigger re-checks every stored result against the policy, and stored checks can't be edited.
- **Best bucks for a doe:** every eligible buck the user can see, ranked low → restricted, then by COI and completeness.
- **Record a mating:** step 1 runs a fresh check for each buck, step 2 records it. The database requires a check by the same person against the current pedigree and policy. Restricted pairings need an owner or the farm's manager and a written reason (kept with the check). High risk or not-enough-pedigree results need the warning acknowledged. Several bucks running with a doe = uncertain father.
- **Pregnancy checks** (scan, blood test, observation) with an optional due date from the scan; otherwise the due window is mating date + 150 days, always shown as an estimate.
- **Kidding:** singles to octuplets, stillborn kids counted. Live kids are registered on the doe's farm and pen with dam and sire linked, or with all the bucks as *possible sires* when the father is uncertain. Recording the sire later settles it.
- **Breeding policy:** owners set the thresholds, blocked relationships and the founder assumption, and record the advisor who confirmed them. Changing a threshold clears the confirmation. Defaults (low < 3.125%, high ≥ 6.25%, restricted ≥ 12.5% or parent–offspring / full / half siblings, completeness ≥ 70% over 3 generations) are starting values for a qualified breeding advisor to confirm.
- **Who can do what:** anyone can check a pairing; owners and assigned managers, workers and vets record matings, checks and kiddings on their farms; only owners change the policy.

**Deploying the Edge Function.** After changing the engine or `packages/breeding-service`, run `npm run bundle:breeding` and commit `supabase/functions/breeding/core.bundle.js` (CI fails if it is stale). Deploy with `npx supabase functions deploy breeding --no-verify-jwt` (the function checks the session itself). The live copy imports the bundle from its pinned Git commit through jsDelivr, so it is byte-for-byte the tested file.

## The herd (M3)

- **Register an animal** as bought, born on the farm, received, or an *ancestor from records only* (from a seller's papers; never on your farm). Only sex is required; tag, name or registration number identify it.
- **Parents** with how they're known (DNA, seen or documented, reported by previous owner, assumed). Changing a parent keeps the old link as history. "From papers" on a profile adds an ancestor and links it in one step.
- **Founder flag** for bought stock with no papers: unknown ancestors are treated as unrelated, and breeding checks will say when a result relies on it.
- **Profile**: details, parents, three-generation family tree with a count of known ancestors, offspring, purchase details (owners and managers only) and an automatic timeline.
- **QR tags**: printable label per animal. The code holds only a link with the animal's random id; scanning opens the profile after sign-in, and shows "Not found" to anyone without access.
- **Who can do what**: workers register animals on their farms but can't edit records, set parents or see prices; vets see their farms; records-only ancestors are visible to everyone in the organization.
- **Enforced by the database**: no animal can be its own ancestor, sires are male and dams female, parents share species and organization, a parent can't be born after its offspring (exact dates), tags are unique per organization, and edits can't break existing links.

## The web app (M1)

- **Auth:** email and password sign-up with email confirmation, sign-in, password reset, sign-out. Sessions are refreshed in `proxy.ts`; pages check the user with `getClaims()`.
- **Onboarding:** create an organization and its first farm; you become the owner.
- **Farms and pens:** owners add farms; owners and assigned managers edit farm details and add, edit and archive pens.
- **Team:** owners invite by email and role, choose farm access, and get a one-time link to share by WhatsApp, SMS or email. Owners change roles and farm access, pause or restore access, and remove people; anyone can leave.
- **Settings:** your name and phone; organization name, country, currency and time zone (owners).
- **Navigation:** bottom tabs on phones, sidebar on desktop. Only working screens appear; Tasks joins when that milestone ships.
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

**Migrations:** `tenancy_and_access` (schema), `advisor_fixes` (covering indexes; privileged functions behind public wrappers), `profile_email` (email on profiles for the team list), `paused_member_profiles` (owners still see paused members' names), `herd_registry` (species, breeds, animals, parentage, purchases, timeline), `timeline_wording`, `breeding` (policy, assessments, overrides, matings, pregnancy checks, kiddings, candidate sires).

## Supabase project

- Project `herd-intelligence` (ref `rqhhhjlcoavcsqtfnbzx`), Postgres 17, region eu-west-1. All migrations applied; local file names match the remote versions.
- Security advisor: one setting to switch on, leaked-password protection (Authentication settings). Performance advisor: only "unused index" notes.

**Auth settings to set in the dashboard (Authentication → URL Configuration):**
- Site URL: the app's public address once deployed (for now `http://localhost:3000`).
- Redirect URLs: add `http://localhost:3000/**` and, later, the deployed address with `/**`.
- Optional but recommended: in the email templates, point links at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}` (and `type=recovery` for password reset), so links work even when opened on a different device. `/auth/confirm` supports both this and the default link style.
- Supabase's built-in email sender is rate-limited; add a custom SMTP provider before inviting many people.

To work with the database from your own computer: `npx supabase login`, `npx supabase link --project-ref rqhhhjlcoavcsqtfnbzx`, then `npx supabase db push` for new migrations.
