import { Dyadic } from './dyadic.js';
import type { KinshipCalculator } from './kinship.js';
import type { PedigreeView } from './pedigree.js';
import { CONFIDENCE_RANK, type ParentConfidence } from './types.js';

export interface WrightPath {
  ancestorId: string;
  /** buck ... ancestor */
  buckSide: string[];
  /** doe ... ancestor */
  doeSide: string[];
  n: number;
  nPrime: number;
  contribution: Dyadic;
  weakestConfidence: ParentConfidence | null;
}

export interface WrightResult {
  total: Dyadic;
  paths: WrightPath[];
  truncated: boolean;
}

export interface WrightLimits {
  /** Stop listing after this many valid paths (default 10,000). */
  maxPaths?: number;
  /** Stop after this many path-pair comparisons (default 2,000,000). */
  maxPairChecks?: number;
}

/**
 * Wright's path method. A valid path runs from the buck up to a common
 * ancestor A and down to the doe, passing through no animal twice: the two
 * half-paths share only A. Each contributes (1/2)^(n+n'+1) * (1 + F_A).
 */
export function wrightPaths(
  view: PedigreeView,
  kin: KinshipCalculator,
  buckId: string,
  doeId: string,
  limits: WrightLimits = {},
): WrightResult {
  const maxPaths = limits.maxPaths ?? 10_000;
  const maxPairChecks = limits.maxPairChecks ?? 2_000_000;

  const buckAnc = view.ancestorsInclusive(buckId);
  const doeAnc = view.ancestorsInclusive(doeId);
  const common = new Set([...buckAnc].filter((id) => doeAnc.has(id)));

  const buckPaths = upwardPaths(view, buckId, common);
  const doePaths = upwardPaths(view, doeId, common);

  const paths: WrightPath[] = [];
  let total = Dyadic.ZERO;
  let truncated = buckPaths.truncated || doePaths.truncated;
  let checks = 0;

  const ancestors = [...common].sort((x, y) => view.index(y) - view.index(x));
  outer: for (const a of ancestors) {
    const bs = buckPaths.byAncestor.get(a) ?? [];
    const ds = doePaths.byAncestor.get(a) ?? [];
    if (bs.length === 0 || ds.length === 0) continue;
    const fA = kin.inbreeding(a);
    const onePlusF = Dyadic.ONE.add(fA);
    for (const bp of bs) {
      const bSet = new Set(bp.nodes);
      for (const dp of ds) {
        if (++checks > maxPairChecks) {
          truncated = true;
          break outer;
        }
        let disjoint = true;
        for (let i = 0; i < dp.nodes.length - 1; i++) {
          if (bSet.has(dp.nodes[i]!)) {
            disjoint = false;
            break;
          }
        }
        if (!disjoint) continue;
        const n = bp.nodes.length - 1;
        const nPrime = dp.nodes.length - 1;
        const contribution = Dyadic.halfPow(n + nPrime + 1).mul(onePlusF);
        total = total.add(contribution);
        paths.push({
          ancestorId: a,
          buckSide: bp.nodes,
          doeSide: dp.nodes,
          n,
          nPrime,
          contribution,
          weakestConfidence: weakest(bp.weakest, dp.weakest),
        });
        if (paths.length >= maxPaths) {
          truncated = true;
          break outer;
        }
      }
    }
  }
  return { total, paths, truncated };
}

interface UpPath {
  nodes: string[];
  weakest: ParentConfidence | null;
}

function upwardPaths(
  view: PedigreeView,
  start: string,
  targets: Set<string>,
  maxPaths = 200_000,
): { byAncestor: Map<string, UpPath[]>; truncated: boolean } {
  const byAncestor = new Map<string, UpPath[]>();
  let count = 0;
  let truncated = false;
  const walk = (id: string, nodes: string[], weakestSoFar: ParentConfidence | null) => {
    if (truncated) return;
    const here = [...nodes, id];
    if (targets.has(id)) {
      const list = byAncestor.get(id) ?? [];
      list.push({ nodes: here, weakest: weakestSoFar });
      byAncestor.set(id, list);
      if (++count >= maxPaths) {
        truncated = true;
        return;
      }
    }
    const p = view.parents(id);
    for (const link of [p.sire, p.dam]) {
      if (!link) continue;
      walk(link.parentId, here, weakest(weakestSoFar, link.confidence));
    }
  };
  walk(start, [], null);
  return { byAncestor, truncated };
}

export function weakest(
  a: ParentConfidence | null,
  b: ParentConfidence | null,
): ParentConfidence | null {
  if (!a) return b;
  if (!b) return a;
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}
