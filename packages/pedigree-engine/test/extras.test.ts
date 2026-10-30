import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assessPairing,
  defaultGoatPolicy,
  Dyadic,
  PairingInputError,
  Pedigree,
  rankBucksForDoe,
  sha256Hex,
} from '../src/index.js';
import { F, M, f, m } from './fixtures.js';

describe('Ranking bucks for a doe', () => {
  // DOE's sire is PAPA. Candidate bucks cover every band.
  const animals = [
    M('PAPA'), F('MOM'), F('OTHER'), M('GSIRE'), F('GDAM1'), F('GDAM2'),
    f('DOE', 'PAPA', 'MOM'),
    m('BROTHER', 'PAPA', 'OTHER'), // half sibling -> restricted
    m('MYSTERY'), // no pedigree, not a founder -> insufficient
    M('OUTSIDER', { breedId: 'boer' }), // unrelated founder -> low
    M('OUTSIDER2', { breedId: 'kalahari' }), // unrelated founder -> low, other breed
    m('SICK', null, null, { isDeclaredFounder: true, status: 'quarantined' }),
    m('REFONLY', null, null, { isDeclaredFounder: true, ownership: 'external_reference' }),
  ];

  it('orders Low, then Insufficient, then Restricted; drops ineligible bucks', () => {
    const ped = new Pedigree(animals);
    const { ranked, ineligible } = rankBucksForDoe(ped, 'DOE', defaultGoatPolicy(), { preferredBreedId: 'boer' });
    const order = ranked.map((r) => [r.buckId, r.assessment.classification.code]);
    // GSIRE and PAPA are also males in the herd: GSIRE is an unrelated founder (low), PAPA is her sire (restricted).
    expect(order[0]).toEqual(['OUTSIDER', 'low']); // breed objective breaks the tie
    expect(order.slice(0, 3).map((x) => x[1])).toEqual(['low', 'low', 'low']);
    const codes = ranked.map((r) => r.assessment.classification.code);
    expect(codes.indexOf('insufficient')).toBeGreaterThan(codes.lastIndexOf('low'));
    expect(codes.indexOf('restricted')).toBeGreaterThan(codes.lastIndexOf('insufficient'));
    expect(ranked.find((r) => r.buckId === 'MYSTERY')!.assessment.classification.code).toBe('insufficient');
    expect(ineligible.map((i) => i.buckId).sort()).toEqual(['REFONLY', 'SICK']);
    expect(ranked.map((r) => r.rank)).toEqual(ranked.map((_, i) => i + 1));
  });
});

describe('Input validation', () => {
  const ped = new Pedigree([M('B'), F('D'), M('B2'), f('D2', null, null, { speciesId: 'sheep' })]);
  const p = defaultGoatPolicy();
  it('rejects wrong-sex, same-animal and cross-species pairings', () => {
    expect(() => assessPairing(ped, 'D', 'B', p)).toThrow(PairingInputError);
    expect(() => assessPairing(ped, 'B', 'B2', p)).toThrow(PairingInputError);
    expect(() => assessPairing(ped, 'B', 'B', p)).toThrow(PairingInputError);
    expect(() => assessPairing(ped, 'B', 'D2', p)).toThrow(/different species/);
    expect(() => assessPairing(ped, 'B', 'NOPE', p)).toThrow(/not in the pedigree/);
  });
});

describe('Building blocks', () => {
  it('SHA-256 matches Node crypto', () => {
    for (const s of ['', 'abc', 'herd intelligence', 'x'.repeat(1000), 'ẹ̀wúrẹ́ 🐐']) {
      expect(sha256Hex(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
    }
  });

  it('Dyadic arithmetic is exact', () => {
    const a = Dyadic.halfPow(5).mul(Dyadic.ONE.add(Dyadic.halfPow(2))); // 1/32 * 5/4
    expect(a.toFraction()).toBe('5/128');
    expect(a.toNumber()).toBe(0.0390625);
    expect(Dyadic.halfPow(3).add(Dyadic.halfPow(3)).equals(Dyadic.halfPow(2))).toBe(true);
    expect(Dyadic.ZERO.toFraction()).toBe('0');
  });

  it('assessment records engine version, method and policy snapshot', () => {
    const ped = new Pedigree([M('B'), F('D')]);
    const a = assessPairing(ped, 'B', 'D', defaultGoatPolicy(), { pedigreeRevision: 7 });
    expect(a.engineVersion).toBe('1.0.0');
    expect(a.method).toBe('tabular-kinship+wright-paths');
    expect(a.policy.minCompleteness).toBe(0.7);
    expect(a.pedigreeRevision).toBe(7);
    expect(a.pedigreeHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
