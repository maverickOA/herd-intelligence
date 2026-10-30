/**
 * The 23 test cases from the Herd Intelligence Phase 1 Technical Plan.
 * Expected values are worked by hand and asserted as exact fractions.
 */
import { describe, expect, it } from 'vitest';
import {
  assessPairing,
  checkParentLink,
  defaultGoatPolicy,
  Pedigree,
  PedigreeValidationError,
  type PairingAssessment,
} from '../src/index.js';
import * as fx from './fixtures.js';
import { F, M, f, m } from './fixtures.js';
import type { AnimalInput } from '../src/index.js';
import { fromDyadicFraction, referenceCoi } from './reference.js';

const policy = defaultGoatPolicy();

function run(c: fx.Case, p = policy, revision?: number): PairingAssessment {
  return assessPairing(new Pedigree(c.animals), c.buck, c.doe, p, { pedigreeRevision: revision });
}

/** Every assessment must also agree with the independent reference implementation. */
function expectMatchesReference(c: fx.Case, a: PairingAssessment) {
  const ref = referenceCoi(c.animals, c.buck, c.doe);
  expect(fromDyadicFraction(a.knownCoi.exact).equals(ref)).toBe(true);
}

describe('Plan test cases', () => {
  it('1. Unrelated founders: 0%, Low, labelled as depending on the founder assumption', () => {
    const c = fx.unrelatedFounders();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('0');
    expect(a.classification.code).toBe('low');
    expect(a.completeness.recorded.pci).toBeCloseTo(1 / 3, 10);
    expect(a.completeness.founderAdjusted.pci).toBe(1);
    expect(a.completeness.usesFounderAssumption).toBe(true);
    expect(a.limitations.join(' ')).toMatch(/founder assumption/i);
    expect(a.explanation.join(' ')).toMatch(/founder assumption/i);

    const noFounders = run(c, { ...policy, allowFounderAssumption: false });
    expect(noFounders.classification.code).toBe('insufficient');
    expect(noFounders.completeness.usesFounderAssumption).toBe(false);
    expectMatchesReference(c, a);
  });

  it('2. Father x daughter: 25%, Restricted, one path with n = 0 and n′ = 1', () => {
    const c = fx.fatherDaughter();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/4');
    expect(a.classification.code).toBe('restricted');
    expect(a.classification.requiresOverride).toBe(true);
    expect(a.relationships.map((r) => r.code)).toContain('parent-offspring');
    expect(a.relationships[0]!.label).toMatch(/^Father and daughter/);
    const paths = a.commonAncestors.flatMap((x) => x.paths);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatchObject({ n: 0, nPrime: 1 });
    expectMatchesReference(c, a);
  });

  it('3. Mother x son: 25%, Restricted', () => {
    const c = fx.motherSon();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/4');
    expect(a.classification.code).toBe('restricted');
    expect(a.relationships[0]!.code).toBe('parent-offspring');
    expect(a.relationships[0]!.label).toMatch(/^Mother and son/);
    expectMatchesReference(c, a);
  });

  it('4. Full siblings: 25%, Restricted, two common ancestors at 12.5% each', () => {
    const c = fx.fullSiblings();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/4');
    expect(a.classification.code).toBe('restricted');
    expect(a.relationships.map((r) => r.code)).toEqual(['full-siblings']);
    expect(a.commonAncestors.map((x) => [x.ancestorId, x.contribution.exact]).sort()).toEqual([
      ['P', '1/8'],
      ['Q', '1/8'],
    ]);
    expectMatchesReference(c, a);
  });

  it('5. Half siblings: 12.5%, Restricted', () => {
    const c = fx.halfSiblings();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/8');
    expect(a.classification.code).toBe('restricted');
    expect(a.relationships.map((r) => r.code)).toEqual(['half-siblings']);
    expectMatchesReference(c, a);
  });

  it('6. First cousins: 6.25%, High, two common ancestors at 3.125% each', () => {
    const c = fx.firstCousins();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/16');
    expect(a.classification.code).toBe('high');
    expect(a.relationships.map((r) => r.code)).toEqual(['first-cousins']);
    expect(a.commonAncestors.map((x) => x.contribution.exact)).toEqual(['1/32', '1/32']);
    expectMatchesReference(c, a);
  });

  it('7. Half first cousins: 3.125%, Elevated (boundary: not below the low limit)', () => {
    const c = fx.halfFirstCousins();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/32');
    expect(a.knownCoi.value).toBe(policy.lowBandMax);
    expect(a.classification.code).toBe('elevated');
    expect(a.relationships.map((r) => r.code)).toEqual(['half-first-cousins']);
    expectMatchesReference(c, a);
  });

  it('8. Double first cousins: 12.5%, Restricted at policy maximum, four ancestors at 3.125%', () => {
    const c = fx.doubleFirstCousins();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/8');
    expect(a.classification.code).toBe('restricted');
    expect(a.relationships.map((r) => r.code)).toEqual(['double-first-cousins']);
    expect(a.commonAncestors).toHaveLength(4);
    expect(a.commonAncestors.every((x) => x.contribution.exact === '1/32')).toBe(true);
    expect(a.explanation.join(' ')).toMatch(/policy maximum/);
    expectMatchesReference(c, a);
  });

  it('9. Second cousins: 1.5625%, Low, two paths with n = n′ = 3', () => {
    const c = fx.secondCousins();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/64');
    expect(a.classification.code).toBe('low');
    expect(a.relationships.map((r) => r.code)).toEqual(['second-cousins']);
    const paths = a.commonAncestors.flatMap((x) => x.paths);
    expect(paths).toHaveLength(2);
    expect(paths.every((p) => p.n === 3 && p.nPrime === 3)).toBe(true);
    expectMatchesReference(c, a);
  });

  it('10. Inbred common ancestor, close: 15.625% = 12.5% x (1 + 0.25), Restricted', () => {
    const c = fx.inbredAncestorClose();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('5/32');
    expect(a.classification.code).toBe('restricted');
    expect(a.commonAncestors).toHaveLength(1);
    expect(a.commonAncestors[0]).toMatchObject({ ancestorId: 'A' });
    expect(a.commonAncestors[0]!.inbreedingOfAncestor.exact).toBe('1/4');
    expectMatchesReference(c, a);
  });

  it('11. Inbred common ancestor, distant: 3.90625%, Elevated; F_A applied, no extra paths', () => {
    const c = fx.inbredAncestorDistant();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('5/128');
    expect(a.knownCoi.display).toBe('3.90625%');
    expect(a.classification.code).toBe('elevated');
    expect(a.commonAncestors.map((x) => x.ancestorId)).toEqual(['A']);
    expectMatchesReference(c, a);
  });

  it('12. No recorded parents: 0%, Insufficient, never Low', () => {
    const c = fx.noRecordedParents();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('0');
    expect(a.completeness.used).toBeCloseTo(1 / 3, 10);
    expect(a.classification.code).toBe('insufficient');
    expect(a.classification.code).not.toBe('low');
    expectMatchesReference(c, a);
  });

  it('13. Parents only: 0%, Insufficient (PCI 0.67, below the 0.70 minimum)', () => {
    const c = fx.parentsOnly();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('0');
    expect(a.completeness.used).toBeCloseTo(2 / 3, 10);
    expect(a.classification.code).toBe('insufficient');
    expectMatchesReference(c, a);
  });

  it('14. Incomplete but already close: 6.25%, High not Insufficient (known COI is a floor)', () => {
    const c = fx.incompleteFirstCousins();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/16');
    expect(a.completeness.used).toBeCloseTo(2 / 3, 10);
    expect(a.completeness.used).toBeLessThan(policy.minCompleteness);
    expect(a.classification.code).toBe('high');
    expectMatchesReference(c, a);
  });

  it('15. Incomplete with floor in Elevated band: Insufficient, known floor shown', () => {
    const c = fx.incompleteHalfFirstCousins();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/32');
    expect(a.knownBand).toBe('elevated');
    expect(a.classification.code).toBe('insufficient');
    expect(a.explanation.join(' ')).toMatch(/Known COI is already 3\.125% \(elevated band\)/);
    expectMatchesReference(c, a);
  });

  it('16. Uncertain sire: 0% recorded, 12.5% worst case, Restricted as possible half siblings', () => {
    const c = fx.uncertainSire();
    const a = run(c);
    expect(a.knownCoi.exact).toBe('0');
    expect(a.worstCaseCoi?.exact).toBe('1/8');
    expect(a.worstCaseScenario?.assignment).toEqual({ DOE: 'S2' });
    expect(a.worstCaseScenario?.relationships.map((r) => r.code)).toEqual(['half-siblings']);
    expect(a.classification.code).toBe('restricted');
    expect(a.classification.possible).toBe(true);
    expect(a.explanation.join(' ')).toMatch(/could be up to 12\.5%/);
    expect(a.limitations.join(' ')).toMatch(/Paternity of DOE is uncertain/);
  });

  it('17. Parentage correction: 0% before, 12.5% after; old assessment untouched', () => {
    const before = run(fx.correctionBefore(), policy, 1);
    const after = run(fx.correctionAfter(), policy, 2);
    expect(before.knownCoi.exact).toBe('0');
    expect(after.knownCoi.exact).toBe('1/8');
    expect(after.classification.code).toBe('restricted');
    expect(before.pedigreeHash).not.toBe(after.pedigreeHash);
    expect(before.pedigreeRevision).toBe(1);
    expect(after.pedigreeRevision).toBe(2);
    // Saved assessments are immutable.
    expect(Object.isFrozen(before)).toBe(true);
    expect(() => {
      (before.knownCoi as { exact: string }).exact = '1/8';
    }).toThrow();
    expect(before.knownCoi.exact).toBe('0');
  });

  it('18. Low-confidence link: 12.5% main, 0% verified-only, assumed link named', () => {
    const c = fx.halfSiblings({ buck: 'observed', doe: 'assumed' });
    const a = run(c);
    expect(a.knownCoi.exact).toBe('1/8');
    expect(a.verifiedOnlyCoi.exact).toBe('0');
    expect(a.classification.code).toBe('restricted');
    expect(a.weakestContributingConfidence).toBe('assumed');
    expect(a.limitations.join(' ')).toMatch(/assumed parent link: P as parent of DOE/);
    expect(a.limitations.join(' ')).toMatch(/DNA-confirmed or observed parent links, COI would be 0%/);
  });

  it('19. Circular ancestry: rejected at write time and at load time', () => {
    const ped = new Pedigree([M('G'), F('X'), m('S', 'G', 'X'), m('B', 'S', 'X')]);
    // Make the grandson the sire of his grandsire.
    const loop = checkParentLink(ped, 'G', 'B', 'sire');
    expect(loop.map((i) => i.code)).toContain('circular-ancestry');
    // Make a goat its own dam.
    const self = checkParentLink(ped, 'X', 'X', 'dam');
    expect(self.map((i) => i.code)).toEqual(['self-parent']);
    // A looped graph never reaches the engine.
    try {
      new Pedigree([m('G', 'B', 'X'), F('X'), m('S', 'G', 'X'), m('B', 'S', 'X')]);
      throw new Error('expected rejection');
    } catch (e) {
      expect(e).toBeInstanceOf(PedigreeValidationError);
      expect((e as PedigreeValidationError).issues.map((i) => i.code)).toContain('circular-ancestry');
    }
  });

  it('20. Invalid parents: wrong sex, another organization, born after child', () => {
    const codes = (animals: AnimalInput[]) => {
      try {
        new Pedigree(animals);
        return [];
      } catch (e) {
        return (e as PedigreeValidationError).issues.map((i) => i.code);
      }
    };
    expect(codes([F('NOTMALE'), F('D'), m('K', 'NOTMALE', 'D')])).toEqual(['sire-not-male']);
    expect(codes([M('S', { orgId: 'org-b' }), F('D', { orgId: 'org-a' }), m('K', 'S', 'D', { orgId: 'org-a' })])).toEqual([
      'org-mismatch',
    ]);
    expect(
      codes([M('S', { birthDate: '2024-06-01' }), F('D'), m('K', 'S', 'D', { birthDate: '2024-01-01' })]),
    ).toEqual(['parent-born-after-child']);
    // Estimated dates are not held to the birth-order rule.
    expect(
      codes([M('S', { birthDate: '2024-06-01', birthDateEstimated: true }), F('D'), m('K', 'S', 'D', { birthDate: '2024-01-01' })]),
    ).toEqual([]);
    // Single-link check mirrors the database trigger.
    const ped = new Pedigree([F('NOTMALE'), F('D'), m('K', null, 'D')]);
    expect(checkParentLink(ped, 'K', 'NOTMALE', 'sire').map((i) => i.code)).toEqual(['sire-not-male']);
  });

  // 21 (10,000 random pedigrees) and 22 (reference cross-check on a large pedigree) are in random.test.ts.

  it('23. Order independence: shuffled input gives identical COI and hash', () => {
    for (const make of [fx.inbredAncestorDistant, fx.secondCousins, fx.uncertainSire]) {
      const c = make();
      const a = run(c);
      const shuffled = [...c.animals].reverse();
      const rotated = [...c.animals.slice(3), ...c.animals.slice(0, 3)];
      for (const animals of [shuffled, rotated]) {
        const b = run({ ...c, animals });
        expect(b.knownCoi.exact).toBe(a.knownCoi.exact);
        expect(b.pedigreeHash).toBe(a.pedigreeHash);
        expect(b.classification.code).toBe(a.classification.code);
      }
    }
  });
});

describe('Interface rules', () => {
  it('no result ever uses the word "safe"', () => {
    for (const make of Object.values(fx.ALL_CASES)) {
      const a = run(make());
      const text = [...a.explanation, ...a.limitations, a.classification.label].join(' ');
      expect(text.toLowerCase()).not.toMatch(/\bsafe\b/);
    }
  });

  it('every Insufficient result shows the known floor and its band', () => {
    for (const make of Object.values(fx.ALL_CASES)) {
      const a = run(make());
      if (a.classification.code !== 'insufficient') continue;
      expect(a.explanation.join(' ')).toMatch(/Known COI is already [\d.]+% \((low|elevated|high) band\)/);
    }
  });
});
