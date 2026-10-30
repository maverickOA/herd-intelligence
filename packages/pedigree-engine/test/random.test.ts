/**
 * Case 21: Wright's path total equals the kinship result, exactly, on 10,000
 * random pedigrees up to 12 generations deep with inbreeding.
 * Case 22: kinship equals an independent tabular A-matrix implementation, on
 * the same random pedigrees and on one large, realistically shaped pedigree.
 */
import { describe, expect, it } from 'vitest';
import { assessPairing, defaultGoatPolicy, KinshipCalculator, Pedigree, type AnimalInput } from '../src/index.js';
import { fromDyadicFraction, referenceCoi } from './reference.js';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Gen {
  animals: AnimalInput[];
  males: string[];
  females: string[];
}

function randomPedigree(seed: number, opts: { maxGenerations: number; maxPerGen: number; founders: number; knownRate: number }): Gen {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const animals: AnimalInput[] = [];
  const males: string[] = [];
  const females: string[] = [];
  const add = (sex: 'male' | 'female', sireId: string | null, damId: string | null, founder: boolean) => {
    const id = `a${animals.length}`;
    animals.push({ id, sex, speciesId: 'goat', sireId, damId, isDeclaredFounder: founder });
    (sex === 'male' ? males : females).push(id);
  };
  const nf = 1 + Math.floor(r() * opts.founders);
  for (let i = 0; i < nf; i++) add('male', null, null, true);
  for (let i = 0; i < nf; i++) add('female', null, null, true);
  const gens = Math.min(opts.maxGenerations, 3 + Math.floor(r() * (opts.maxGenerations - 2)));
  for (let g = 0; g < gens; g++) {
    // Only parents that already exist: guarantees no cycles.
    const ms = [...males];
    const fs = [...females];
    const n = 1 + Math.floor(r() * opts.maxPerGen);
    for (let i = 0; i < n; i++) {
      const sire = r() < opts.knownRate ? pick(ms) : null;
      const dam = r() < opts.knownRate ? pick(fs) : null;
      add(r() < 0.5 ? 'male' : 'female', sire, dam, false);
    }
  }
  return { animals, males, females };
}

describe('Random pedigrees', () => {
  it('21. path total === kinship === reference, exactly, on 10,000 random pedigrees', () => {
    const policy = defaultGoatPolicy();
    let checked = 0;
    let truncated = 0;
    let nonZero = 0;
    let inbredAncestorSeen = 0;
    for (let seed = 1; seed <= 10_000; seed++) {
      const g = randomPedigree(seed, { maxGenerations: 12, maxPerGen: 3, founders: 2, knownRate: 0.85 });
      const r = rng(seed * 7919);
      const buck = g.males[Math.floor(r() * g.males.length)]!;
      const doe = g.females[Math.floor(r() * g.females.length)]!;
      const a = assessPairing(new Pedigree(g.animals), buck, doe, policy);
      // assessPairing throws EngineConsistencyError if paths and kinship differ;
      // check the path total explicitly as well.
      if (a.explanationTruncated) {
        truncated++;
      } else {
        const pathTotal = a.commonAncestors
          .map((x) => fromDyadicFraction(x.contribution.exact))
          .reduce((s, v) => s.add(v), fromDyadicFraction('0'));
        expect(pathTotal.equals(fromDyadicFraction(a.knownCoi.exact))).toBe(true);
      }
      const ref = referenceCoi(g.animals, buck, doe);
      expect(fromDyadicFraction(a.knownCoi.exact).equals(ref)).toBe(true);
      if (a.knownCoi.value > 0) nonZero++;
      if (a.commonAncestors.some((x) => x.inbreedingOfAncestor.value > 0)) inbredAncestorSeen++;
      checked++;
    }
    expect(checked).toBe(10_000);
    // The suite must actually exercise related and inbred pedigrees.
    expect(nonZero).toBeGreaterThan(3_000);
    expect(inbredAncestorSeen).toBeGreaterThan(500);
    expect(truncated).toBeLessThan(100);
    console.log(`random: ${checked} checked, ${nonZero} related pairs, ${inbredAncestorSeen} with inbred common ancestors, ${truncated} path lists truncated`);
  }, 300_000);

  it('verified-only figure matches the reference with low-confidence links removed', () => {
    const policy = defaultGoatPolicy();
    const confs = ['dna', 'observed', 'reported', 'assumed'] as const;
    for (let seed = 1; seed <= 1_000; seed++) {
      const g = randomPedigree(seed, { maxGenerations: 8, maxPerGen: 3, founders: 3, knownRate: 0.9 });
      const r = rng(seed * 31);
      const animals = g.animals.map((a) => ({
        ...a,
        sireConfidence: confs[Math.floor(r() * 4)]!,
        damConfidence: confs[Math.floor(r() * 4)]!,
      }));
      const buck = g.males[Math.floor(r() * g.males.length)]!;
      const doe = g.females[Math.floor(r() * g.females.length)]!;
      const a = assessPairing(new Pedigree(animals), buck, doe, policy);
      const verified = (x: AnimalInput, role: 'sire' | 'dam') => {
        const c = role === 'sire' ? x.sireConfidence : x.damConfidence;
        return c === 'dna' || c === 'observed';
      };
      expect(fromDyadicFraction(a.verifiedOnlyCoi.exact).equals(referenceCoi(animals, buck, doe, verified))).toBe(true);
      expect(fromDyadicFraction(a.verifiedOnlyCoi.exact).equals(referenceCoi(animals, buck, doe)) ||
        a.verifiedOnlyCoi.value <= a.knownCoi.value).toBe(true);
    }
  }, 120_000);

  it('22. large realistic pedigree: 2,000+ animals over 15 generations matches the reference', () => {
    const r = rng(20261030);
    const animals: AnimalInput[] = [];
    const males: string[] = [];
    const females: string[] = [];
    const add = (sex: 'male' | 'female', sireId: string | null, damId: string | null) => {
      const id = `g${animals.length}`;
      animals.push({ id, sex, speciesId: 'goat', sireId, damId, isDeclaredFounder: sireId === null && damId === null });
      (sex === 'male' ? males : females).push(id);
      return id;
    };
    // 40 founders, then a herd that keeps a few bucks per generation (realistic: few sires, many does).
    for (let i = 0; i < 8; i++) add('male', null, null);
    for (let i = 0; i < 32; i++) add('female', null, null);
    let bucks = [...males];
    let does = [...females];
    for (let gen = 0; gen < 15; gen++) {
      const nextBucks: string[] = [];
      const nextDoes: string[] = [];
      for (let k = 0; k < 135; k++) {
        const sire = bucks[Math.floor(r() * bucks.length)]!;
        const dam = does[Math.floor(r() * does.length)]!;
        const known = r();
        const id = add(r() < 0.5 ? 'male' : 'female', known < 0.95 ? sire : null, known < 0.9 || known >= 0.95 ? dam : null);
        (animals[animals.length - 1]!.sex === 'male' ? nextBucks : nextDoes).push(id);
      }
      bucks = nextBucks.slice(0, 6);
      does = [...nextDoes, ...does.slice(0, 20)];
    }
    expect(animals.length).toBeGreaterThan(2_000);
    const ped = new Pedigree(animals);
    const kin = new KinshipCalculator(ped.view());
    const lastMales = males.slice(-40);
    const lastFemales = females.slice(-40);
    for (let i = 0; i < 25; i++) {
      const buck = lastMales[Math.floor(r() * lastMales.length)]!;
      const doe = lastFemales[Math.floor(r() * lastFemales.length)]!;
      const coi = kin.offspringCoi(buck, doe);
      const ref = referenceCoi(animals, buck, doe);
      expect(fromDyadicFraction(coi.toFraction()).equals(ref)).toBe(true);
    }
  }, 300_000);
});
