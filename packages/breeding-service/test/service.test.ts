import { describe, expect, it } from 'vitest';
import { BreedingRequestError, handle, parseRequest, rank, type PedigreeSnapshot, type SnapshotAnimal } from '../src/index.js';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const a = (n: number, sex: 'male' | 'female', o: Partial<SnapshotAnimal> = {}): SnapshotAnimal => ({
  id: U(n), sex, speciesId: 'goat', visible: true, label: `A${n}`, breedId: null, birthDate: null,
  birthDateEstimated: false, sireId: null, sireConfidence: null, damId: null, damConfidence: null,
  candidateSireIds: [], isDeclaredFounder: true, status: 'active', ownership: 'owned', ...o,
});
const policy = {
  id: U(99), speciesId: 'goat', lowBandMax: 0.03125, highBandMin: 0.0625, maxCoi: 0.125, minCompleteness: 0.7,
  generations: 3, blockedRelationships: ['parent-offspring', 'full-siblings', 'half-siblings'],
  allowFounderAssumption: true, advisorName: null, advisorNote: null,
};
const snap = (animals: SnapshotAnimal[], bucks: string[] = []): PedigreeSnapshot => ({
  orgId: U(100), speciesId: 'goat', revision: 7, policy, policyVersion: 1, gestationDays: 150, bucks, animals,
});

describe('requests', () => {
  it('accepts only well-formed requests', () => {
    expect(parseRequest({ action: 'rank', doeId: U(1) })).toEqual({ action: 'rank', doeId: U(1) });
    expect(parseRequest({ action: 'assess', buckId: U(1), doeId: U(2) })).toMatchObject({ purpose: 'check' });
    expect(() => parseRequest({ action: 'assess', buckId: U(1), doeId: U(1) })).toThrow(BreedingRequestError);
    expect(() => parseRequest({ action: 'assess', buckId: "x' or 1=1", doeId: U(1) })).toThrow(/Choose a buck/);
    expect(() => parseRequest({ action: 'delete' })).toThrow(/Unknown/);
  });

  it('never passes labels to the engine, so explanations use ids only', async () => {
    // Half siblings through a sire the user cannot see (label withheld anyway).
    const s = snap([
      a(1, 'male', { visible: false, label: null }),
      a(2, 'female'), a(3, 'female'),
      a(4, 'male', { isDeclaredFounder: false, sireId: U(1), sireConfidence: 'observed', damId: U(2), damConfidence: 'observed', label: 'BUCK' }),
      a(5, 'female', { isDeclaredFounder: false, sireId: U(1), sireConfidence: 'observed', damId: U(3), damConfidence: 'observed', label: 'DOE' }),
    ]);
    let saved: unknown;
    const r = await handle({ action: 'assess', buckId: U(4), doeId: U(5), purpose: 'check' }, {
      userId: U(50), getPedigree: async () => s, saveAssessment: async (row) => { saved = row; return U(77); },
    });
    if (r.action !== 'assess') throw new Error();
    expect(r.assessmentId).toBe(U(77));
    expect(r.assessment.classification.code).toBe('restricted');
    expect(JSON.stringify(r.assessment)).not.toMatch(/BUCK|DOE|A1\b/);
    expect(saved).toMatchObject({ classification: 'restricted', relationships: ['half-siblings'], pedigree_revision: 7, requested_by: U(50) });
  });

  it('refuses a pairing the wrong way round', async () => {
    const s = snap([a(1, 'male'), a(2, 'female')]);
    await expect(handle({ action: 'assess', buckId: U(2), doeId: U(1) }, {
      userId: U(50), getPedigree: async () => s, saveAssessment: async () => U(1),
    })).rejects.toThrow(/must be a buck/);
  });

  it('ranking uses only the bucks the database listed', () => {
    const s = snap([a(1, 'male'), a(2, 'male'), a(3, 'female')], [U(1)]);
    const r = rank(s, U(3));
    expect(r.ranked.map((x) => x.buckId)).toEqual([U(1)]);
  });
});
