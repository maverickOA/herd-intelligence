/**
 * Independent reference implementation used only by tests.
 *
 * Henderson's tabular method: build the additive relationship matrix A over the
 * ancestors of the pair, then offspring COI = A[sire][dam] / 2. Written from
 * scratch with BigInt rationals and no code shared with the engine, so it can
 * act as a cross-check rather than a copy.
 */
import type { AnimalInput } from '../src/types.js';

export class Rational {
  constructor(readonly n: bigint, readonly d: bigint) {
    if (d === 0n) throw new Error('zero denominator');
  }
  static readonly ZERO = new Rational(0n, 1n);
  static readonly ONE = new Rational(1n, 1n);
  static norm(n: bigint, d: bigint): Rational {
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n < 0n ? -n : n, d);
    return new Rational(n / g, d / g);
  }
  add(o: Rational): Rational { return Rational.norm(this.n * o.d + o.n * this.d, this.d * o.d); }
  div(k: bigint): Rational { return Rational.norm(this.n, this.d * k); }
  equals(o: Rational): boolean { return this.n * o.d === o.n * this.d; }
  toString(): string { return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`; }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

export function fromDyadicFraction(s: string): Rational {
  const [n, d] = s.split('/');
  return Rational.norm(BigInt(n!), BigInt(d ?? '1'));
}

export function referenceCoi(
  animals: readonly AnimalInput[],
  sireId: string,
  damId: string,
  linkFilter: (child: AnimalInput, role: 'sire' | 'dam') => boolean = () => true,
): Rational {
  const byId = new Map(animals.map((a) => [a.id, a]));
  const sire = (id: string) => {
    const a = byId.get(id)!;
    return a.sireId && linkFilter(a, 'sire') ? a.sireId : null;
  };
  const dam = (id: string) => {
    const a = byId.get(id)!;
    return a.damId && linkFilter(a, 'dam') ? a.damId : null;
  };

  // Collect ancestors of the pair.
  const keep = new Set<string>();
  const stack = [sireId, damId];
  while (stack.length) {
    const id = stack.pop()!;
    if (keep.has(id)) continue;
    keep.add(id);
    const s = sire(id), d = dam(id);
    if (s) stack.push(s);
    if (d) stack.push(d);
  }

  // Kahn's algorithm: parents before children.
  const ids = [...keep];
  const indeg = new Map(ids.map((id) => [id, 0]));
  const kids = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const id of ids) {
    for (const p of [sire(id), dam(id)]) {
      if (p) { indeg.set(id, indeg.get(id)! + 1); kids.get(p)!.push(id); }
    }
  }
  const queue = ids.filter((id) => indeg.get(id) === 0).sort();
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const k of kids.get(id)!) {
      indeg.set(k, indeg.get(k)! - 1);
      if (indeg.get(k) === 0) queue.push(k);
    }
  }
  if (order.length !== ids.length) throw new Error('reference: cycle');

  const idx = new Map(order.map((id, i) => [id, i]));
  const n = order.length;
  const A: Rational[][] = Array.from({ length: n }, () => new Array<Rational>(n).fill(Rational.ZERO));
  const get = (i: number | null, j: number | null) => (i === null || j === null ? Rational.ZERO : A[i]![j]!);
  for (let i = 0; i < n; i++) {
    const id = order[i]!;
    const si = sire(id) ? idx.get(sire(id)!)! : null;
    const di = dam(id) ? idx.get(dam(id)!)! : null;
    for (let j = 0; j < i; j++) {
      const v = get(j, si).add(get(j, di)).div(2n);
      A[i]![j] = v;
      A[j]![i] = v;
    }
    A[i]![i] = Rational.ONE.add(get(si, di).div(2n));
  }
  return A[idx.get(sireId)!]![idx.get(damId)!]!.div(2n);
}
