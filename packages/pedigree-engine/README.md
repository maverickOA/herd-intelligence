# @herd/pedigree-engine

The breeding engine for Herd Intelligence (milestone M2 of the Phase 1 plan). It checks a proposed buck × doe pairing and returns the kid's known-pedigree COI, the shared ancestors and paths behind it, named relationships, pedigree completeness, a classification and the reasons for it.

Pure TypeScript, no dependencies, no database or network access. The same code runs on the server (authoritative) and on the phone (offline, provisional).

## Status

- **31 tests passing**: all 23 cases from the technical plan, plus ranking, input validation and building-block tests.
- **10,000 random pedigrees** (up to 12 generations, with inbreeding): Wright's path total, the kinship result and an independent reference implementation agree **exactly** on every one.
- **2,000+ animal realistic herd** over 15 generations: kinship matches the reference on 25 random pairings.
- **Mutation-checked**: deliberately breaking Wright's path rule or the (1 + F_A) term makes 7 and 8 tests fail respectively, so the suite really guards the maths.

## Quick start

```bash
npm install
npm test          # runs the full suite (about 5 seconds)
npm run build     # compiles to dist/
```

```ts
import { Pedigree, assessPairing, defaultGoatPolicy } from '@herd/pedigree-engine';

const pedigree = new Pedigree([
  { id: 'P', sex: 'male', speciesId: 'goat', isDeclaredFounder: true },
  { id: 'Q1', sex: 'female', speciesId: 'goat', isDeclaredFounder: true },
  { id: 'Q2', sex: 'female', speciesId: 'goat', isDeclaredFounder: true },
  { id: 'BUCK', sex: 'male', speciesId: 'goat', sireId: 'P', damId: 'Q1', sireConfidence: 'observed' },
  { id: 'DOE', sex: 'female', speciesId: 'goat', sireId: 'P', damId: 'Q2' },
]);

const a = assessPairing(pedigree, 'BUCK', 'DOE', defaultGoatPolicy(), { pedigreeRevision: 12 });
a.knownCoi.display;          // "12.5%"
a.knownCoi.exact;            // "1/8"
a.classification.label;      // "Restricted by farm breeding policy"
a.relationships[0].label;    // "Half siblings (shared parent: P)"
a.explanation;               // plain-English reasons, ready for the screen
```

Other entry points: `rankBucksForDoe` (compare every eligible buck against a doe), `checkParentLink` (validate one parent link before saving, mirroring the database trigger), `KinshipCalculator` and `wrightPaths` for lower-level use.

## How it works

1. **Validation.** Building a `Pedigree` rejects circular ancestry, self-parents, wrong-sex parents, cross-species or cross-organization parents, and parents born after the child (exact dates only).
2. **Kinship (the number).** Recursive, memoized coancestry: `F(kid) = f(buck, doe)`. Unknown parents contribute zero, so the result is a lower bound. All arithmetic is exact (BigInt numerator over a power of two), so thresholds are never crossed by rounding.
3. **Wright's paths (the explanation).** Every pair of lines from buck and doe to a common ancestor that share no animal except that ancestor, each contributing `(1/2)^(n+n'+1) × (1 + F_A)`. The total must equal step 2 exactly; if not, the engine throws `EngineConsistencyError` and shows nothing.
4. **Verified-only COI** using only DNA-confirmed and observed links, shown when it differs.
5. **Uncertain paternity.** For animals with candidate sires, every combination (up to 64) is evaluated; the worst case drives the classification and is marked `possible`.
6. **Relationships** named from the nearest common ancestors (parent and offspring, siblings, uncle or aunt, cousins of each degree, and so on).
7. **Completeness**: pedigree completeness index over the policy's generations (generation 1 = buck or doe), both as recorded and with declared founders' missing ancestors counted as resolved. Results that depend on founders are labelled.
8. **Classification**, first match wins: Restricted (blocked relationship or COI at policy maximum), High, Insufficient, Elevated, Low. The known COI and its band are always shown.
9. **Audit**: engine version, method, policy snapshot, pedigree revision and a SHA-256 of every link used. Assessments are deeply frozen.

## Default policy

`defaultGoatPolicy()` returns the starting values agreed in the plan: Low below 3.125%, High from 6.25%, policy maximum 12.5%, minimum completeness 0.70 over 3 generations, parent–offspring and full and half siblings blocked, founder assumption allowed. These are placeholders for a qualified breeding advisor to confirm.

## Known limitations

- The plan suggested also cross-checking against an R package (kinship2 or nadiv). R was not available in this build environment, so the cross-check uses an independent tabular A-matrix implementation written separately in `test/reference.ts`. Adding the R check to CI is still worth doing.
- Path explanations are capped at 10,000 paths; beyond that the COI is still exact but the path list is marked truncated.
- Candidate-sire analysis stops at 64 combinations and says so.
- Relationship names cover the common cases; unusual combinations fall back to "shared ancestry through X".

## Layout

```
src/
  dyadic.ts         exact arithmetic
  pedigree.ts       validation, views, single-link check
  kinship.ts        recursive kinship (tabular method)
  paths.ts          Wright's path method
  relationships.ts  relationship naming
  completeness.ts   PCI and equivalent complete generations
  engine.ts         assessPairing, classification, explanations
  rank.ts           rankBucksForDoe
  sha256.ts         dependency-free hashing
test/
  plan-cases.test.ts  the plan's 23 cases
  random.test.ts      10,000 random pedigrees + large herd
  extras.test.ts      ranking, validation, building blocks
  reference.ts        independent A-matrix implementation
  fixtures.ts         hand-built pedigrees
```
