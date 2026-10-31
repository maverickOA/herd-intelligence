/**
 * Breeding service: runs the pedigree engine on the snapshot returned by the
 * database function breeding_pedigree() and shapes what is stored.
 *
 * Runs inside the Supabase "breeding" Edge Function (bundled by esbuild) and
 * in the database tests. Animal labels are never passed to the engine, so
 * every explanation refers to animals by id; the app swaps ids for labels the
 * viewer is allowed to see.
 */
import {
  ENGINE_VERSION,
  Pedigree,
  PedigreeValidationError,
  assessPairing,
  rankBucksForDoe,
  type AnimalInput,
  type AnimalStatus,
  type BreedingPolicy,
  type Ownership,
  type PairingAssessment,
  type ParentConfidence,
} from '../../pedigree-engine/src/index.js';

export { ENGINE_VERSION };
export type { PairingAssessment };

export interface SnapshotAnimal {
  id: string;
  sex: 'male' | 'female';
  speciesId: string;
  visible: boolean;
  label: string | null;
  breedId: string | null;
  birthDate: string | null;
  birthDateEstimated: boolean;
  sireId: string | null;
  sireConfidence: ParentConfidence | null;
  damId: string | null;
  damConfidence: ParentConfidence | null;
  candidateSireIds: string[];
  isDeclaredFounder: boolean;
  status: AnimalStatus | null;
  ownership: Ownership;
}

export interface SnapshotPolicy {
  id: string;
  speciesId: string;
  lowBandMax: number;
  highBandMin: number;
  maxCoi: number;
  minCompleteness: number;
  generations: number;
  blockedRelationships: string[];
  allowFounderAssumption: boolean;
  advisorName: string | null;
  advisorNote: string | null;
}

export interface PedigreeSnapshot {
  orgId: string;
  speciesId: string;
  revision: number;
  policy: SnapshotPolicy;
  policyVersion: number;
  gestationDays: number;
  bucks: string[];
  animals: SnapshotAnimal[];
}

/** Row for public.breeding_assessments (inserted with the service role). */
export interface AssessmentRow {
  org_id: string;
  buck_id: string;
  doe_id: string;
  purpose: 'check' | 'mating';
  requested_by: string;
  engine_version: string;
  pedigree_revision: number;
  pedigree_hash: string;
  policy_id: string;
  policy_version: number;
  policy: SnapshotPolicy;
  classification: PairingAssessment['classification']['code'];
  possible: boolean;
  requires_override: boolean;
  known_coi: number;
  verified_coi: number;
  worst_case_coi: number | null;
  classified_coi: number;
  completeness: number;
  uses_founder_assumption: boolean;
  relationships: string[];
  result: PairingAssessment;
}

/** A request the caller got wrong (shown to the user as is). */
export class BreedingRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'BreedingRequestError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BreedingRequest =
  | { action: 'assess'; buckId: string; doeId: string; purpose: 'check' | 'mating' }
  | { action: 'rank'; doeId: string };

export function parseRequest(body: unknown): BreedingRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const id = (v: unknown, what: string) => {
    if (typeof v !== 'string' || !UUID.test(v)) throw new BreedingRequestError(`Choose a ${what}`);
    return v.toLowerCase();
  };
  if (b.action === 'assess') {
    const purpose = b.purpose === 'mating' ? 'mating' : 'check';
    const buckId = id(b.buckId, 'buck');
    const doeId = id(b.doeId, 'doe');
    if (buckId === doeId) throw new BreedingRequestError('Choose two different animals');
    return { action: 'assess', buckId, doeId, purpose };
  }
  if (b.action === 'rank') return { action: 'rank', doeId: id(b.doeId, 'doe') };
  throw new BreedingRequestError('Unknown request');
}

function toPolicy(p: SnapshotPolicy): BreedingPolicy {
  return {
    id: p.id,
    speciesId: p.speciesId,
    lowBandMax: Number(p.lowBandMax),
    highBandMin: Number(p.highBandMin),
    maxCoi: Number(p.maxCoi),
    minCompleteness: Number(p.minCompleteness),
    generations: Number(p.generations),
    blockedRelationships: p.blockedRelationships as BreedingPolicy['blockedRelationships'],
    allowFounderAssumption: p.allowFounderAssumption,
    ...(p.advisorName ? { advisorName: p.advisorName } : {}),
    ...(p.advisorNote ? { advisorNote: p.advisorNote } : {}),
  };
}

export function toPedigree(s: PedigreeSnapshot): Pedigree {
  const animals: AnimalInput[] = s.animals.map((a) => ({
    id: a.id,
    sex: a.sex,
    speciesId: a.speciesId,
    orgId: s.orgId,
    ...(a.breedId ? { breedId: a.breedId } : {}),
    ...(a.birthDate ? { birthDate: a.birthDate, birthDateEstimated: a.birthDateEstimated } : {}),
    sireId: a.sireId,
    damId: a.damId,
    ...(a.sireConfidence ? { sireConfidence: a.sireConfidence } : {}),
    ...(a.damConfidence ? { damConfidence: a.damConfidence } : {}),
    ...(a.candidateSireIds.length && !a.sireId ? { candidateSireIds: a.candidateSireIds } : {}),
    isDeclaredFounder: a.isDeclaredFounder,
    ...(a.status ? { status: a.status } : {}),
    ownership: a.ownership,
  }));
  try {
    return new Pedigree(animals);
  } catch (e) {
    if (e instanceof PedigreeValidationError) {
      // The database enforces the same rules; reaching this means a bug, so fail closed.
      throw new BreedingRequestError('The pedigree data failed validation, so no result is shown. ' + e.message, 500);
    }
    throw e;
  }
}

export function assessmentRow(
  s: PedigreeSnapshot,
  a: PairingAssessment,
  purpose: 'check' | 'mating',
  userId: string,
): AssessmentRow {
  return {
    org_id: s.orgId,
    buck_id: a.buckId,
    doe_id: a.doeId,
    purpose,
    requested_by: userId,
    engine_version: a.engineVersion,
    pedigree_revision: s.revision,
    pedigree_hash: a.pedigreeHash,
    policy_id: s.policy.id,
    policy_version: s.policyVersion,
    // Stored exactly as the database gave it, so the insert trigger can compare.
    policy: s.policy,
    classification: a.classification.code,
    possible: a.classification.possible,
    requires_override: a.classification.requiresOverride,
    known_coi: a.knownCoi.value,
    verified_coi: a.verifiedOnlyCoi.value,
    worst_case_coi: a.worstCaseCoi?.value ?? null,
    classified_coi: a.classifiedCoi.value,
    completeness: a.completeness.used,
    uses_founder_assumption: a.completeness.usesFounderAssumption,
    relationships: [
      ...new Set([...a.relationships.map((r) => r.code), ...(a.worstCaseScenario?.relationships.map((r) => r.code) ?? [])]),
    ],
    result: a,
  };
}

function checkPair(s: PedigreeSnapshot, buckId: string, doeId: string) {
  const buck = s.animals.find((x) => x.id === buckId);
  const doe = s.animals.find((x) => x.id === doeId);
  if (!buck || !doe) throw new BreedingRequestError('Animal not found', 404);
  if (buck.sex !== 'male') throw new BreedingRequestError('The first animal must be a buck');
  if (doe.sex !== 'female') throw new BreedingRequestError('The second animal must be a doe');
}

export function assess(s: PedigreeSnapshot, buckId: string, doeId: string): PairingAssessment {
  checkPair(s, buckId, doeId);
  return assessPairing(toPedigree(s), buckId, doeId, toPolicy(s.policy), { pedigreeRevision: s.revision });
}

export interface RankedSummary {
  rank: number;
  buckId: string;
  classification: PairingAssessment['classification'];
  knownCoi: PairingAssessment['knownCoi'];
  classifiedCoi: PairingAssessment['classifiedCoi'];
  worstCaseCoi: PairingAssessment['worstCaseCoi'];
  completeness: number;
  usesFounderAssumption: boolean;
  relationships: { code: string; label: string }[];
}

export interface RankResult {
  doeId: string;
  revision: number;
  policy: SnapshotPolicy;
  ranked: RankedSummary[];
  ineligible: { buckId: string; reason: string }[];
}

export function rank(s: PedigreeSnapshot, doeId: string): RankResult {
  const doe = s.animals.find((x) => x.id === doeId);
  if (!doe) throw new BreedingRequestError('Animal not found', 404);
  if (doe.sex !== 'female') throw new BreedingRequestError('Choose a doe');
  const preferredBreedId = doe.breedId ?? undefined;
  const { ranked, ineligible } = rankBucksForDoe(toPedigree(s), doeId, toPolicy(s.policy), {
    candidateIds: s.bucks,
    pedigreeRevision: s.revision,
    ...(preferredBreedId ? { preferredBreedId } : {}),
  });
  return {
    doeId,
    revision: s.revision,
    policy: s.policy,
    ranked: ranked.map((r) => ({
      rank: r.rank,
      buckId: r.buckId,
      classification: r.assessment.classification,
      knownCoi: r.assessment.knownCoi,
      classifiedCoi: r.assessment.classifiedCoi,
      worstCaseCoi: r.assessment.worstCaseCoi,
      completeness: r.assessment.completeness.used,
      usesFounderAssumption: r.assessment.completeness.usesFounderAssumption,
      relationships: r.assessment.relationships.map((x) => ({ code: x.code, label: x.label })),
    })),
    ineligible,
  };
}

export interface ServiceDeps {
  userId: string;
  getPedigree(animalIds: string[], withBucks: boolean): Promise<PedigreeSnapshot>;
  saveAssessment(row: AssessmentRow): Promise<string>;
}

export type ServiceResponse =
  | { action: 'assess'; assessmentId: string; assessment: PairingAssessment }
  | { action: 'rank'; result: RankResult };

/** The whole request flow, minus HTTP and Supabase clients (injected). */
export async function handle(body: unknown, deps: ServiceDeps): Promise<ServiceResponse> {
  const req = parseRequest(body);
  if (req.action === 'rank') {
    const s = await deps.getPedigree([req.doeId], true);
    return { action: 'rank', result: rank(s, req.doeId) };
  }
  const s = await deps.getPedigree([req.buckId, req.doeId], false);
  const a = assess(s, req.buckId, req.doeId);
  const id = await deps.saveAssessment(assessmentRow(s, a, req.purpose, deps.userId));
  return { action: 'assess', assessmentId: id, assessment: a };
}
