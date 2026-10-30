import type { PedigreeView } from './pedigree.js';
import type { SideCompleteness } from './types.js';

interface Slot {
  id: string | null;
  /** Counted as resolved because a declared founder sits below it. */
  covered: boolean;
}

/**
 * Share of ancestors known per generation on one side of the proposed kid.
 * Generation 1 is the buck or doe itself, generation 2 its parents, and so on.
 * With founderAdjusted, a declared founder's missing ancestors count as resolved.
 */
export function sideCompleteness(
  view: PedigreeView,
  rootId: string,
  generations: number,
  founderAdjusted: boolean,
): SideCompleteness {
  const perGeneration: number[] = [];
  let level: Slot[] = [{ id: rootId, covered: false }];
  for (let g = 1; g <= generations; g++) {
    const known = level.filter((s) => s.id !== null || s.covered).length;
    perGeneration.push(known / level.length);
    if (g === generations) break;
    const next: Slot[] = [];
    for (const s of level) {
      if (s.covered) {
        next.push({ id: null, covered: true }, { id: null, covered: true });
      } else if (s.id === null) {
        next.push({ id: null, covered: false }, { id: null, covered: false });
      } else {
        const founder = founderAdjusted && !!view.pedigree.get(s.id).isDeclaredFounder;
        const sire = view.sireOf(s.id);
        const dam = view.damOf(s.id);
        next.push({ id: sire, covered: !sire && founder }, { id: dam, covered: !dam && founder });
      }
    }
    level = next;
  }
  const index = perGeneration.reduce((a, b) => a + b, 0) / generations;
  return { perGeneration, index };
}

/** Pedigree completeness index: harmonic mean of the two sides (MacCluer et al., 1983). */
export function pci(paternal: number, maternal: number): number {
  if (paternal + maternal === 0) return 0;
  return (2 * paternal * maternal) / (paternal + maternal);
}

/**
 * Equivalent complete generations of the proposed kid: sum over every recorded
 * ancestor of (1/2)^g, where the buck and doe are g = 1.
 */
export function equivalentCompleteGenerations(
  view: PedigreeView,
  buckId: string,
  doeId: string,
  maxGenerations = 30,
): number {
  let total = 0;
  let level: string[] = [buckId, doeId];
  for (let g = 1; g <= maxGenerations && level.length; g++) {
    total += level.length * 0.5 ** g;
    const next: string[] = [];
    for (const id of level) {
      const s = view.sireOf(id);
      const d = view.damOf(id);
      if (s) next.push(s);
      if (d) next.push(d);
    }
    level = next;
  }
  return total;
}
