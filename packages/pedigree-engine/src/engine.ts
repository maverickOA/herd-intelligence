import { equivalentCompleteGenerations, pci, sideCompleteness } from './completeness.js';
import { Dyadic } from './dyadic.js';
import { KinshipCalculator } from './kinship.js';
import { wrightPaths, weakest, type WrightLimits, type WrightPath } from './paths.js';
import { Pedigree, PedigreeValidationError, type PedigreeView } from './pedigree.js';
import { identifyRelationships } from './relationships.js';
import { sha256Hex } from './sha256.js';
import {
  CLASSIFICATION_LABEL,
  type Band,
  type BreedingPolicy,
  type ClassificationCode,
  type CoiValue,
  type CommonAncestorDetail,
  type CompletenessResult,
  type PairingAssessment,
  type ParentConfidence,
  type RelationshipDetail,
  type UncertainSireScenario,
} from './types.js';

export const ENGINE_VERSION = '1.0.0';

/** Starting values for discussion with a qualified breeding advisor. Not breeding advice. */
export function defaultGoatPolicy(speciesId = 'goat'): BreedingPolicy {
  return {
    id: 'default-goat-v1',
    speciesId,
    lowBandMax: 0.03125,
    highBandMin: 0.0625,
    maxCoi: 0.125,
    minCompleteness: 0.7,
    generations: 3,
    blockedRelationships: ['parent-offspring', 'full-siblings', 'half-siblings'],
    allowFounderAssumption: true,
  };
}

export class PairingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PairingInputError';
  }
}

/** Thrown when Wright's paths and the kinship method disagree. The engine fails closed. */
export class EngineConsistencyError extends Error {
  constructor(readonly kinship: string, readonly pathTotal: string) {
    super(`Engine consistency check failed: kinship ${kinship} != path total ${pathTotal}. No result is shown.`);
    this.name = 'EngineConsistencyError';
  }
}

export interface AssessOptions {
  pedigreeRevision?: number;
  wrightLimits?: WrightLimits;
  /** Maximum candidate-sire combinations to evaluate (default 64). */
  maxSireScenarios?: number;
}

const VERIFIED: ReadonlySet<ParentConfidence> = new Set(['dna', 'observed']);

export function assessPairing(
  pedigree: Pedigree,
  buckId: string,
  doeId: string,
  policy: BreedingPolicy,
  options: AssessOptions = {},
): PairingAssessment {
  validatePair(pedigree, buckId, doeId, policy);
  const label = (id: string) => pedigree.label(id);

  // 1. Known-pedigree COI by kinship, every recorded link.
  const view = pedigree.view();
  const kin = new KinshipCalculator(view);
  const known = kin.offspringCoi(buckId, doeId);

  // 2. Wright's paths explain it and must agree exactly.
  const wright = wrightPaths(view, kin, buckId, doeId, options.wrightLimits);
  if (!wright.truncated && !wright.total.equals(known)) {
    throw new EngineConsistencyError(known.toFraction(), wright.total.toFraction());
  }

  // 3. Verified-only sensitivity figure.
  const verifiedView = pedigree.view({ allowedConfidence: VERIFIED });
  const verified = new KinshipCalculator(verifiedView).offspringCoi(buckId, doeId);

  // 4. Uncertain paternity: worst case across candidate sires.
  const scen = sireScenarios(pedigree, view, buckId, doeId, options.maxSireScenarios ?? 64);

  // 5. Relationships.
  const relationships = identifyRelationships(view, buckId, doeId);

  // 6. Completeness.
  const completeness = computeCompleteness(view, buckId, doeId, policy);

  // 7. Classification.
  const worst = scen.worst;
  const classifiedCoi = worst && worst.coi.compare(known) > 0 ? worst.coi : known;
  const scenarioRels = worst ? worst.relationships : [];
  const blocked = (rels: RelationshipDetail[]) =>
    rels.find((r) => policy.blockedRelationships.includes(r.code));
  const recordedBlocked = blocked(relationships);
  const possibleBlocked = recordedBlocked ? undefined : blocked(scenarioRels);
  const blockedHit = recordedBlocked ?? possibleBlocked;

  const classify = (v: Dyadic, hit: RelationshipDetail | undefined): ClassificationCode => {
    if (hit || v.compareNumber(policy.maxCoi) >= 0) return 'restricted';
    if (v.compareNumber(policy.highBandMin) >= 0) return 'high';
    if (completeness.used < policy.minCompleteness) return 'insufficient';
    if (v.compareNumber(policy.lowBandMax) >= 0) return 'elevated';
    return 'low';
  };
  const code = classify(classifiedCoi, blockedHit);
  // "Possible" when the result is stricter only because of a candidate (unconfirmed) sire.
  const possible = code !== classify(known, recordedBlocked);

  // 8. Explanation material.
  const commonAncestors = groupPaths(wright.paths, kin, label);
  const weakestConf = wright.paths.reduce<ParentConfidence | null>((w, p) => weakest(w, p.weakestConfidence), null);
  const fBuck = kin.inbreeding(buckId).toNumber();
  const fDoe = kin.inbreeding(doeId).toNumber();
  const rValue = (2 * known.toNumber()) / Math.sqrt((1 + fBuck) * (1 + fDoe));

  const hashIds = scen.relevantIds;
  const pedigreeHash = sha256Hex(
    [...hashIds]
      .sort()
      .map((id) => {
        const a = pedigree.get(id);
        const s = a.sireId ? `${a.sireId}:${a.sireConfidence ?? 'reported'}` : '';
        const d = a.damId ? `${a.damId}:${a.damConfidence ?? 'reported'}` : '';
        const c = (a.candidateSireIds ?? []).slice().sort().join(',');
        return `${id}|s=${s}|d=${d}|f=${a.isDeclaredFounder ? 1 : 0}|c=${c}`;
      })
      .join('\n'),
  );

  const knownBand = bandOf(known, policy);
  const limitations = buildLimitations({
    pedigree, view, buckId, doeId, policy, completeness, known, verified,
    paths: wright.paths, truncated: wright.truncated, scen,
  });
  const explanation = buildExplanation({
    code, known, classifiedCoi, knownBand, completeness, policy, blockedHit,
    possible, worst, label, relationships,
  });

  const assessment: PairingAssessment = {
    engineVersion: ENGINE_VERSION,
    method: 'tabular-kinship+wright-paths',
    buckId,
    doeId,
    policy: { ...policy, blockedRelationships: [...policy.blockedRelationships] },
    pedigreeRevision: options.pedigreeRevision ?? null,
    pedigreeHash,
    knownCoi: coi(known),
    verifiedOnlyCoi: coi(verified),
    worstCaseCoi: worst ? coi(worst.coi) : null,
    worstCaseScenario: worst
      ? { assignment: Object.fromEntries(worst.assignment), coi: coi(worst.coi), relationships: worst.relationships }
      : null,
    knownBand,
    classifiedCoi: coi(classifiedCoi),
    classification: {
      code,
      label: CLASSIFICATION_LABEL[code],
      possible,
      requiresOverride: code === 'restricted',
    },
    relationships,
    coefficientOfRelationship: { exact: String(rValue), value: rValue, display: pct(rValue) },
    commonAncestors,
    explanationTruncated: wright.truncated,
    completeness,
    weakestContributingConfidence: weakestConf,
    limitations,
    explanation,
  };
  return deepFreeze(assessment);
}

function validatePair(pedigree: Pedigree, buckId: string, doeId: string, policy: BreedingPolicy) {
  if (!pedigree.has(buckId)) throw new PairingInputError(`Buck ${buckId} is not in the pedigree`);
  if (!pedigree.has(doeId)) throw new PairingInputError(`Doe ${doeId} is not in the pedigree`);
  if (buckId === doeId) throw new PairingInputError('Buck and doe must be different animals');
  const b = pedigree.get(buckId);
  const d = pedigree.get(doeId);
  if (b.sex !== 'male') throw new PairingInputError(`${pedigree.label(buckId)} is not male`);
  if (d.sex !== 'female') throw new PairingInputError(`${pedigree.label(doeId)} is not female`);
  if (b.speciesId !== d.speciesId) throw new PairingInputError('Buck and doe are different species');
  if (policy.speciesId !== b.speciesId) throw new PairingInputError('Breeding policy is for a different species');
  if (policy.generations < 1) throw new PairingInputError('Policy generations must be at least 1');
}

interface Scenario {
  assignment: Map<string, string>;
  coi: Dyadic;
  relationships: RelationshipDetail[];
}

interface ScenarioResult {
  uncertainIds: string[];
  worst: Scenario | null;
  skipped: boolean;
  relevantIds: Set<string>;
}

function sireScenarios(
  pedigree: Pedigree,
  view: PedigreeView,
  buckId: string,
  doeId: string,
  maxScenarios: number,
): ScenarioResult {
  // Everything that could matter: ancestors of buck and doe, plus candidate sires and their ancestors.
  const relevant = new Set<string>([...view.ancestorsInclusive(buckId), ...view.ancestorsInclusive(doeId)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...relevant]) {
      for (const c of pedigree.get(id).candidateSireIds ?? []) {
        for (const anc of view.ancestorsInclusive(c)) {
          if (!relevant.has(anc)) {
            relevant.add(anc);
            changed = true;
          }
        }
      }
    }
  }
  const uncertainIds = [...relevant]
    .filter((id) => !view.sireOf(id) && (pedigree.get(id).candidateSireIds?.length ?? 0) > 0)
    .sort();
  if (uncertainIds.length === 0) return { uncertainIds, worst: null, skipped: false, relevantIds: relevant };

  const options = uncertainIds.map((id) => [...pedigree.get(id).candidateSireIds!].sort());
  const total = options.reduce((n, o) => n * o.length, 1);
  if (total > maxScenarios) return { uncertainIds, worst: null, skipped: true, relevantIds: relevant };

  let worst: Scenario | null = null;
  const pick = (i: number, acc: Map<string, string>) => {
    if (i === uncertainIds.length) {
      let v: PedigreeView;
      try {
        v = pedigree.view({ sireOverrides: acc });
      } catch (e) {
        if (e instanceof PedigreeValidationError) return; // candidate would create a loop: impossible scenario
        throw e;
      }
      const c = new KinshipCalculator(v).offspringCoi(buckId, doeId);
      if (!worst || c.compare(worst.coi) > 0) {
        worst = { assignment: new Map(acc), coi: c, relationships: identifyRelationships(v, buckId, doeId) };
      }
      return;
    }
    for (const cand of options[i]!) {
      acc.set(uncertainIds[i]!, cand);
      pick(i + 1, acc);
      acc.delete(uncertainIds[i]!);
    }
  };
  pick(0, new Map());
  return { uncertainIds, worst, skipped: false, relevantIds: relevant };
}

function computeCompleteness(
  view: PedigreeView,
  buckId: string,
  doeId: string,
  policy: BreedingPolicy,
): CompletenessResult {
  const d = policy.generations;
  const rb = sideCompleteness(view, buckId, d, false);
  const rd = sideCompleteness(view, doeId, d, false);
  const ab = sideCompleteness(view, buckId, d, true);
  const ad = sideCompleteness(view, doeId, d, true);
  const recordedPci = pci(rb.index, rd.index);
  const adjustedPci = pci(ab.index, ad.index);
  const usesFounder = policy.allowFounderAssumption && adjustedPci > recordedPci;
  return {
    generations: d,
    recorded: { pci: recordedPci, buck: rb, doe: rd },
    founderAdjusted: { pci: adjustedPci, buck: ab, doe: ad },
    used: policy.allowFounderAssumption ? adjustedPci : recordedPci,
    usesFounderAssumption: usesFounder,
    equivalentCompleteGenerations: equivalentCompleteGenerations(view, buckId, doeId),
  };
}

function groupPaths(
  paths: WrightPath[],
  kin: KinshipCalculator,
  label: (id: string) => string,
): CommonAncestorDetail[] {
  const by = new Map<string, WrightPath[]>();
  for (const p of paths) {
    const list = by.get(p.ancestorId) ?? [];
    list.push(p);
    by.set(p.ancestorId, list);
  }
  const out: CommonAncestorDetail[] = [];
  for (const [a, list] of by) {
    const total = list.reduce((s, p) => s.add(p.contribution), Dyadic.ZERO);
    out.push({
      ancestorId: a,
      ancestorLabel: label(a),
      inbreedingOfAncestor: coi(kin.inbreeding(a)),
      contribution: coi(total),
      paths: list.map((p) => ({
        buckSide: p.buckSide,
        doeSide: p.doeSide,
        n: p.n,
        nPrime: p.nPrime,
        contribution: coi(p.contribution),
        weakestConfidence: p.weakestConfidence,
      })),
    });
  }
  return out.sort((x, y) => y.contribution.value - x.contribution.value || x.ancestorId.localeCompare(y.ancestorId));
}

function bandOf(v: Dyadic, policy: BreedingPolicy): Band {
  if (v.compareNumber(policy.lowBandMax) < 0) return 'low';
  if (v.compareNumber(policy.highBandMin) < 0) return 'elevated';
  return 'high';
}

interface LimitationInput {
  pedigree: Pedigree;
  view: PedigreeView;
  buckId: string;
  doeId: string;
  policy: BreedingPolicy;
  completeness: CompletenessResult;
  known: Dyadic;
  verified: Dyadic;
  paths: WrightPath[];
  truncated: boolean;
  scen: ScenarioResult;
}

function buildLimitations(x: LimitationInput): string[] {
  const out: string[] = [];
  const label = (id: string) => x.pedigree.label(id);
  if (x.completeness.recorded.pci < 1) {
    out.push(
      `Ancestry is incomplete within ${x.policy.generations} generations (recorded completeness ${fmt(x.completeness.recorded.pci)}). ` +
        'Unrecorded ancestors can only add relatedness, so the true COI may be higher than the known figure.',
    );
  }
  for (const id of [x.buckId, x.doeId]) {
    const missing = [!x.view.sireOf(id) && 'sire', !x.view.damOf(id) && 'dam'].filter(Boolean);
    if (missing.length) out.push(`${label(id)} has no recorded ${missing.join(' or ')}.`);
  }
  if (x.completeness.usesFounderAssumption) {
    const founders = [...x.view.ancestorsInclusive(x.buckId), ...x.view.ancestorsInclusive(x.doeId)]
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .filter((id) => x.pedigree.get(id).isDeclaredFounder && (!x.view.sireOf(id) || !x.view.damOf(id)))
      .sort();
    out.push(
      `Depends on founder assumption: ${founders.map(label).join(', ')} treated as unrelated, non-inbred base animals.`,
    );
  }
  if (!x.verified.equals(x.known)) {
    out.push(
      `Using only DNA-confirmed or observed parent links, COI would be ${pct(x.verified.toNumber())}. ` +
        'The difference rests on reported or assumed parentage.',
    );
  }
  const assumed = new Set<string>();
  for (const p of x.paths) {
    for (const side of [p.buckSide, p.doeSide]) {
      for (let i = 0; i < side.length - 1; i++) {
        const child = side[i]!;
        const parent = side[i + 1]!;
        const link = x.view.parents(child);
        const l = link.sire?.parentId === parent ? link.sire : link.dam;
        if (l?.confidence === 'assumed') assumed.add(`${label(parent)} as parent of ${label(child)}`);
      }
    }
  }
  if (assumed.size) out.push(`A contributing path relies on an assumed parent link: ${[...assumed].sort().join('; ')}.`);
  for (const id of x.scen.uncertainIds) {
    const c = (x.pedigree.get(id).candidateSireIds ?? []).map(label).sort().join(', ');
    out.push(`Paternity of ${label(id)} is uncertain (candidate sires: ${c}).`);
  }
  if (x.scen.skipped) {
    out.push('Too many uncertain-sire combinations to evaluate; the worst case was not computed. Resolve paternity to get a full check.');
  }
  if (x.truncated) {
    out.push('Path explanation truncated because the pedigree has very many paths; the COI itself is exact.');
  }
  return out;
}

interface ExplanationInput {
  code: ClassificationCode;
  known: Dyadic;
  classifiedCoi: Dyadic;
  knownBand: Band;
  completeness: CompletenessResult;
  policy: BreedingPolicy;
  blockedHit: RelationshipDetail | undefined;
  possible: boolean;
  worst: Scenario | null;
  label: (id: string) => string;
  relationships: RelationshipDetail[];
}

function buildExplanation(x: ExplanationInput): string[] {
  const out: string[] = [];
  out.push(`Expected kid COI from the recorded pedigree: ${pct(x.known.toNumber())} (exact ${x.known.toFraction()}), ${x.knownBand} band.`);
  if (x.worst && x.worst.coi.compare(x.known) > 0) {
    const who = [...x.worst.assignment].map(([k, v]) => `${x.label(v)} as sire of ${x.label(k)}`).join('; ');
    out.push(`If paternity resolves as ${who}, COI could be up to ${pct(x.worst.coi.toNumber())}.`);
  }
  if (x.relationships.length) out.push(`Relationship: ${x.relationships.map((r) => r.label).join('; ')}.`);
  const p = x.possible ? 'Possibly ' : '';
  const c = pct(x.classifiedCoi.toNumber());
  switch (x.code) {
    case 'restricted':
      out.push(
        x.blockedHit
          ? `${p}restricted: "${x.blockedHit.label}" is a blocked relationship under this farm's policy. An authorized override with a written reason is required.`
          : `${p}restricted: COI ${c} is at or above the policy maximum of ${pct(x.policy.maxCoi)}. An authorized override with a written reason is required.`,
      );
      break;
    case 'high':
      out.push(`${p}high risk: COI ${c} is at or above the high threshold of ${pct(x.policy.highBandMin)}. Missing ancestors can only raise it.`);
      break;
    case 'insufficient':
      out.push(
        `Insufficient pedigree information: completeness ${fmt(x.completeness.used)} is below the policy minimum of ${fmt(x.policy.minCompleteness)}. ` +
          `Known COI is already ${pct(x.known.toNumber())} (${x.knownBand} band); the true value may be higher.`,
      );
      break;
    case 'elevated':
      out.push(`${p}elevated risk: COI ${c} is between ${pct(x.policy.lowBandMax)} and ${pct(x.policy.highBandMin)}, with completeness ${fmt(x.completeness.used)}.`);
      break;
    case 'low':
      out.push(
        `Low known pedigree risk: COI ${c} is below ${pct(x.policy.lowBandMax)} with completeness ${fmt(x.completeness.used)}. ` +
          'This reflects recorded ancestry only and is not a guarantee.',
      );
      break;
  }
  if (x.completeness.usesFounderAssumption) out.push('This result depends on the farm\'s founder assumption.');
  return out;
}

function coi(v: Dyadic): CoiValue {
  return { exact: v.toFraction(), value: v.toNumber(), display: pct(v.toNumber()) };
}

export function pct(v: number): string {
  const s = (v * 100).toFixed(5).replace(/\.?0+$/, '');
  return `${s}%`;
}

function fmt(v: number): string {
  return v.toFixed(2);
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
