/**
 * Hand-built pedigrees for the plan's test cases. Unless a case says
 * otherwise, base animals are declared, non-inbred founders.
 */
import type { AnimalInput, ParentConfidence } from '../src/types.js';

type Opts = Partial<AnimalInput>;

export const m = (id: string, sire?: string | null, dam?: string | null, o: Opts = {}): AnimalInput => ({
  id, label: id, sex: 'male', speciesId: 'goat', sireId: sire ?? null, damId: dam ?? null, ...o,
});
export const f = (id: string, sire?: string | null, dam?: string | null, o: Opts = {}): AnimalInput => ({
  id, label: id, sex: 'female', speciesId: 'goat', sireId: sire ?? null, damId: dam ?? null, ...o,
});
/** Founder male / female */
export const M = (id: string, o: Opts = {}) => m(id, null, null, { isDeclaredFounder: true, ...o });
export const F = (id: string, o: Opts = {}) => f(id, null, null, { isDeclaredFounder: true, ...o });

export interface Case {
  animals: AnimalInput[];
  buck: string;
  doe: string;
}

export const unrelatedFounders = (): Case => ({
  animals: [M('BUCK'), F('DOE')],
  buck: 'BUCK', doe: 'DOE',
});

export const fatherDaughter = (): Case => ({
  animals: [M('BUCK'), F('M1'), f('DOE', 'BUCK', 'M1')],
  buck: 'BUCK', doe: 'DOE',
});

export const motherSon = (): Case => ({
  animals: [F('DOE'), M('S1'), m('BUCK', 'S1', 'DOE')],
  buck: 'BUCK', doe: 'DOE',
});

export const fullSiblings = (): Case => ({
  animals: [M('P'), F('Q'), m('BUCK', 'P', 'Q'), f('DOE', 'P', 'Q')],
  buck: 'BUCK', doe: 'DOE',
});

export const halfSiblings = (conf?: { buck?: ParentConfidence; doe?: ParentConfidence }): Case => ({
  animals: [
    M('P'), F('Q1'), F('Q2'),
    m('BUCK', 'P', 'Q1', conf?.buck ? { sireConfidence: conf.buck } : {}),
    f('DOE', 'P', 'Q2', conf?.doe ? { sireConfidence: conf.doe } : {}),
  ],
  buck: 'BUCK', doe: 'DOE',
});

export const firstCousins = (): Case => ({
  animals: [
    M('GP'), F('GM'),
    m('S1', 'GP', 'GM'), m('S2', 'GP', 'GM'),
    F('M1'), F('M2'),
    m('BUCK', 'S1', 'M1'), f('DOE', 'S2', 'M2'),
  ],
  buck: 'BUCK', doe: 'DOE',
});

export const halfFirstCousins = (): Case => ({
  animals: [
    M('G'), F('GM1'), F('GM2'),
    m('S1', 'G', 'GM1'), m('S2', 'G', 'GM2'),
    F('M1'), F('M2'),
    m('BUCK', 'S1', 'M1'), f('DOE', 'S2', 'M2'),
  ],
  buck: 'BUCK', doe: 'DOE',
});

export const doubleFirstCousins = (): Case => ({
  animals: [
    M('G1'), F('G2'), M('G3'), F('G4'),
    m('SA', 'G1', 'G2'), f('DA', 'G3', 'G4'),
    m('SB', 'G3', 'G4'), f('DB', 'G1', 'G2'),
    m('BUCK', 'SA', 'DA'), f('DOE', 'SB', 'DB'),
  ],
  buck: 'BUCK', doe: 'DOE',
});

export const secondCousins = (): Case => ({
  animals: [
    M('GG1'), F('GG2'),
    m('G1', 'GG1', 'GG2'), m('G2', 'GG1', 'GG2'),
    F('X1'), F('X2'),
    m('P1', 'G1', 'X1'), m('P2', 'G2', 'X2'),
    F('Y1'), F('Y2'),
    m('BUCK', 'P1', 'Y1'), f('DOE', 'P2', 'Y2'),
  ],
  buck: 'BUCK', doe: 'DOE',
});

/** A is the product of a father x daughter mating, so F(A) = 1/4. */
const inbredA = () => [M('P'), F('MQ'), f('Q', 'P', 'MQ'), m('A', 'P', 'Q')];

export const inbredAncestorClose = (): Case => ({
  animals: [...inbredA(), F('M1'), F('M2'), m('BUCK', 'A', 'M1'), f('DOE', 'A', 'M2')],
  buck: 'BUCK', doe: 'DOE',
});

export const inbredAncestorDistant = (): Case => ({
  animals: [
    ...inbredA(), F('X1'), F('X2'),
    m('S1', 'A', 'X1'), m('S2', 'A', 'X2'),
    F('M1'), F('M2'),
    m('BUCK', 'S1', 'M1'), f('DOE', 'S2', 'M2'),
  ],
  buck: 'BUCK', doe: 'DOE',
});

export const noRecordedParents = (): Case => ({
  animals: [m('BUCK'), f('DOE')],
  buck: 'BUCK', doe: 'DOE',
});

export const parentsOnly = (): Case => ({
  animals: [m('S1'), f('M1'), m('S2'), f('M2'), m('BUCK', 'S1', 'M1'), f('DOE', 'S2', 'M2')],
  buck: 'BUCK', doe: 'DOE',
});

/** First cousins through their sires; dams and great-grandparents unknown, no founders. */
export const incompleteFirstCousins = (): Case => ({
  animals: [m('G1'), f('G2'), m('S1', 'G1', 'G2'), m('S2', 'G1', 'G2'), m('BUCK', 'S1'), f('DOE', 'S2')],
  buck: 'BUCK', doe: 'DOE',
});

/** Half first cousins through their sires; everything else unknown, no founders. */
export const incompleteHalfFirstCousins = (): Case => ({
  animals: [m('G'), m('S1', 'G'), m('S2', 'G'), m('BUCK', 'S1'), f('DOE', 'S2')],
  buck: 'BUCK', doe: 'DOE',
});

export const uncertainSire = (): Case => ({
  animals: [
    M('S1'), M('S2'), F('MK'), F('MB'),
    f('DOE', null, 'MK', { candidateSireIds: ['S1', 'S2'] }),
    m('BUCK', 'S2', 'MB'),
  ],
  buck: 'BUCK', doe: 'DOE',
});

export const correctionBefore = (): Case => ({
  animals: [M('X'), M('S'), F('MA'), F('MD'), m('BUCK', 'S', 'MA'), f('DOE', 'X', 'MD')],
  buck: 'BUCK', doe: 'DOE',
});

export const correctionAfter = (): Case => ({
  animals: [M('X'), M('S'), F('MA'), F('MD'), m('BUCK', 'S', 'MA'), f('DOE', 'S', 'MD')],
  buck: 'BUCK', doe: 'DOE',
});

export const ALL_CASES: Record<string, () => Case> = {
  unrelatedFounders, fatherDaughter, motherSon, fullSiblings, halfSiblings: () => halfSiblings(),
  firstCousins, halfFirstCousins, doubleFirstCousins, secondCousins, inbredAncestorClose,
  inbredAncestorDistant, noRecordedParents, parentsOnly, incompleteFirstCousins,
  incompleteHalfFirstCousins, uncertainSire, correctionBefore, correctionAfter,
};
