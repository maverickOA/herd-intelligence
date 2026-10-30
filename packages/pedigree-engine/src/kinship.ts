import { Dyadic } from './dyadic.js';
import type { PedigreeView } from './pedigree.js';

/**
 * Recursive kinship (coancestry) with memoisation — the tabular method
 * restricted to the animals a query actually touches.
 *
 *   f(a,a) = (1 + F(a)) / 2,  F(a) = f(sire(a), dam(a))
 *   f(a,b) = (f(sire(a), b) + f(dam(a), b)) / 2   where a is not an ancestor of b
 *
 * An unknown parent contributes 0: this is exactly the base-population
 * assumption, so results are known-pedigree values (lower bounds).
 */
export class KinshipCalculator {
  private readonly memo = new Map<string, Dyadic>();

  constructor(private readonly view: PedigreeView) {}

  /** Inbreeding coefficient F of an existing animal. */
  inbreeding(id: string): Dyadic {
    return this.kinship(this.view.sireOf(id), this.view.damOf(id));
  }

  /** COI of a proposed offspring of sire x dam. */
  offspringCoi(sireId: string, damId: string): Dyadic {
    return this.kinship(sireId, damId);
  }

  kinship(a: string | null, b: string | null): Dyadic {
    if (!a || !b) return Dyadic.ZERO;
    let ia = this.view.index(a);
    let ib = this.view.index(b);
    // Ensure a is the later (higher-index) animal, so a cannot be an ancestor of b.
    if (ia < ib) {
      [a, b] = [b, a];
      [ia, ib] = [ib, ia];
    }
    const key = `${ia}|${ib}`;
    const hit = this.memo.get(key);
    if (hit) return hit;

    let result: Dyadic;
    if (a === b) {
      result = Dyadic.ONE.add(this.kinship(this.view.sireOf(a), this.view.damOf(a))).half();
    } else {
      result = this.kinship(this.view.sireOf(a), b).add(this.kinship(this.view.damOf(a), b)).half();
    }
    this.memo.set(key, result);
    return result;
  }
}
