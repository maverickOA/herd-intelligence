import { assessPairing, type AssessOptions } from './engine.js';
import type { Pedigree } from './pedigree.js';
import type { AnimalStatus, BreedingPolicy, ClassificationCode, PairingAssessment } from './types.js';

const ORDER: Record<ClassificationCode, number> = {
  low: 0,
  elevated: 1,
  insufficient: 2,
  high: 3,
  restricted: 4,
};

const INELIGIBLE_STATUS: ReadonlySet<AnimalStatus> = new Set(['sold', 'deceased', 'culled', 'quarantined']);

export interface RankOptions extends AssessOptions {
  /** Bucks to consider; defaults to every animal in the pedigree. */
  candidateIds?: string[];
  /** Breed objective: matching bucks sort first within the same band and COI. */
  preferredBreedId?: string;
}

export interface RankedBuck {
  rank: number;
  buckId: string;
  breedMatch: boolean;
  assessment: PairingAssessment;
}

export interface IneligibleBuck {
  buckId: string;
  reason: string;
}

/**
 * Compare every eligible buck against one doe. Order: classification band
 * (Low, Elevated, Insufficient, High, Restricted), then lower COI, then higher
 * completeness, then breed objective. Missing pedigree never outranks a
 * well-documented Elevated pairing.
 */
export function rankBucksForDoe(
  pedigree: Pedigree,
  doeId: string,
  policy: BreedingPolicy,
  options: RankOptions = {},
): { ranked: RankedBuck[]; ineligible: IneligibleBuck[] } {
  const doe = pedigree.get(doeId);
  const ids = options.candidateIds ?? pedigree.allIds();
  const ranked: Omit<RankedBuck, 'rank'>[] = [];
  const ineligible: IneligibleBuck[] = [];

  for (const id of ids) {
    if (id === doeId) continue;
    const a = pedigree.get(id);
    if (a.sex !== 'male') {
      if (options.candidateIds) ineligible.push({ buckId: id, reason: 'Not male' });
      continue;
    }
    if (a.speciesId !== doe.speciesId) {
      ineligible.push({ buckId: id, reason: 'Different species' });
      continue;
    }
    if (a.ownership === 'external_reference' || a.ownership === 'sold') {
      ineligible.push({ buckId: id, reason: a.ownership === 'sold' ? 'Sold' : 'Not on the farm (pedigree reference only)' });
      continue;
    }
    if (a.status && INELIGIBLE_STATUS.has(a.status)) {
      ineligible.push({ buckId: id, reason: `Status: ${a.status}` });
      continue;
    }
    const assessment = assessPairing(pedigree, id, doeId, policy, options);
    ranked.push({
      buckId: id,
      breedMatch: !!options.preferredBreedId && a.breedId === options.preferredBreedId,
      assessment,
    });
  }

  ranked.sort((x, y) => {
    const ax = x.assessment;
    const ay = y.assessment;
    return (
      ORDER[ax.classification.code] - ORDER[ay.classification.code] ||
      ax.classifiedCoi.value - ay.classifiedCoi.value ||
      ay.completeness.used - ax.completeness.used ||
      Number(y.breedMatch) - Number(x.breedMatch) ||
      x.buckId.localeCompare(y.buckId)
    );
  });
  return { ranked: ranked.map((r, i) => ({ ...r, rank: i + 1 })), ineligible };
}
