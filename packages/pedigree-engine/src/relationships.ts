import type { PedigreeView } from './pedigree.js';
import type { RelationshipCode, RelationshipDetail } from './types.js';

/**
 * Names the relationship between buck and doe from their nearest common
 * ancestors (common ancestors with no other common ancestor below them).
 */
export function identifyRelationships(
  view: PedigreeView,
  buckId: string,
  doeId: string,
): RelationshipDetail[] {
  const label = (id: string) => view.pedigree.label(id);
  const buckDist = generationDistances(view, buckId);
  const doeDist = generationDistances(view, doeId);
  const common = [...buckDist.keys()].filter((id) => doeDist.has(id));
  if (common.length === 0) return [];

  const ancestorsOf = new Map<string, Set<string>>();
  for (const id of common) ancestorsOf.set(id, view.ancestorsInclusive(id));
  const nearest = common.filter(
    (a) => !common.some((c) => c !== a && ancestorsOf.get(c)!.has(a)),
  );

  const out: RelationshipDetail[] = [];
  const buckIsSire = view.pedigree.get(buckId).sex === 'male';

  // Direct line: one partner is an ancestor of the other.
  for (const [ancestor, descendant, ancestorIsBuck] of [
    [buckId, doeId, true],
    [doeId, buckId, false],
  ] as const) {
    if (!nearest.includes(ancestor)) continue;
    const k = (ancestorIsBuck ? doeDist : buckDist).get(ancestor)!;
    const n = ancestorIsBuck ? 0 : k;
    const nPrime = ancestorIsBuck ? k : 0;
    const who = ancestorIsBuck
      ? buckIsSire ? 'father' : 'parent'
      : 'mother';
    const other = ancestorIsBuck ? 'daughter' : 'son';
    let code: RelationshipCode;
    let text: string;
    if (k === 1) {
      code = 'parent-offspring';
      text = `${cap(who)} and ${other}: ${label(ancestor)} is a parent of ${label(descendant)}`;
    } else if (k === 2) {
      code = 'grandparent-grandchild';
      text = `Grandparent and grandchild: ${label(ancestor)} is a grandparent of ${label(descendant)}`;
    } else if (k === 3) {
      code = 'great-grandparent-great-grandchild';
      text = `Great-grandparent: ${label(ancestor)} is a great-grandparent of ${label(descendant)}`;
    } else {
      code = 'direct-ancestor';
      text = `Direct ancestor: ${label(ancestor)} is an ancestor of ${label(descendant)}, ${k} generations back`;
    }
    out.push({ code, label: text, viaAncestorIds: [ancestor], n, nPrime });
  }

  // Collateral relationships, grouped by distance from each partner.
  const groups = new Map<string, string[]>();
  for (const a of nearest) {
    if (a === buckId || a === doeId) continue;
    const key = `${buckDist.get(a)}|${doeDist.get(a)}`;
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }
  const keys = [...groups.keys()].sort((x, y) => sumKey(x) - sumKey(y) || x.localeCompare(y));
  for (const key of keys) {
    const via = groups.get(key)!.sort();
    const [n, nPrime] = key.split('|').map(Number) as [number, number];
    const count = via.length;
    const names = via.map(label).join(' and ');
    const lo = Math.min(n, nPrime);
    const hi = Math.max(n, nPrime);
    let code: RelationshipCode;
    let text: string;
    if (lo === 1 && hi === 1) {
      code = count >= 2 ? 'full-siblings' : 'half-siblings';
      text = count >= 2 ? `Full siblings (both parents shared: ${names})` : `Half siblings (shared parent: ${names})`;
    } else if (lo === 1 && hi === 2) {
      code = count >= 2 ? 'uncle-aunt-niece-nephew' : 'half-uncle-aunt-niece-nephew';
      text = count >= 2
        ? `Uncle or aunt and niece or nephew (via ${names})`
        : `Half uncle or aunt and niece or nephew (via ${names})`;
    } else if (lo === 2 && hi === 2) {
      if (count >= 4) {
        code = 'double-first-cousins';
        text = `Double first cousins (${count} shared grandparents: ${names})`;
      } else if (count >= 2) {
        code = 'first-cousins';
        text = `First cousins (${count} shared grandparents: ${names})`;
      } else {
        code = 'half-first-cousins';
        text = `Half first cousins (one shared grandparent: ${names})`;
      }
    } else if (lo === 3 && hi === 3) {
      code = count >= 2 ? 'second-cousins' : 'half-second-cousins';
      text = count >= 2
        ? `Second cousins (shared great-grandparents: ${names})`
        : `Half second cousins (one shared great-grandparent: ${names})`;
    } else {
      code = 'other-shared-ancestry';
      text = `Shared ancestry through ${names} (${n} generations from buck, ${nPrime} from doe)`;
    }
    out.push({ code, label: text, viaAncestorIds: via, n, nPrime });
  }
  return out;
}

/** Shortest number of generations from an animal to each of its ancestors (self = 0). */
function generationDistances(view: PedigreeView, id: string): Map<string, number> {
  const dist = new Map<string, number>([[id, 0]]);
  let frontier = [id];
  let g = 0;
  while (frontier.length) {
    g++;
    const next: string[] = [];
    for (const cur of frontier) {
      for (const p of [view.sireOf(cur), view.damOf(cur)]) {
        if (p && !dist.has(p)) {
          dist.set(p, g);
          next.push(p);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

function sumKey(k: string): number {
  const [a, b] = k.split('|').map(Number) as [number, number];
  return a + b;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
