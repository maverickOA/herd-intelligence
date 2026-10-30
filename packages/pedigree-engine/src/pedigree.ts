import type { AnimalInput, ParentConfidence } from './types.js';

export interface ValidationIssue {
  code:
    | 'duplicate-id'
    | 'missing-parent'
    | 'self-parent'
    | 'circular-ancestry'
    | 'sire-not-male'
    | 'dam-not-female'
    | 'species-mismatch'
    | 'org-mismatch'
    | 'parent-born-after-child'
    | 'candidate-not-male'
    | 'candidate-with-recorded-sire';
  animalId: string;
  message: string;
}

export class PedigreeValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(
      `Pedigree is invalid (${issues.length} issue${issues.length === 1 ? '' : 's'}): ` +
        issues.map((i) => i.message).join('; '),
    );
    this.name = 'PedigreeValidationError';
  }
}

export interface ParentLink {
  parentId: string;
  confidence: ParentConfidence;
}

export interface ResolvedParents {
  sire: ParentLink | null;
  dam: ParentLink | null;
}

/** Options that change which links a view sees. */
export interface ViewOptions {
  /** Only keep links whose confidence is in this set. */
  allowedConfidence?: ReadonlySet<ParentConfidence>;
  /** Assign a sire to animals whose paternity is uncertain (scenario analysis). */
  sireOverrides?: ReadonlyMap<string, string>;
}

/**
 * An immutable, validated pedigree. Construction throws PedigreeValidationError
 * if any record breaks a rule the database also enforces.
 */
export class Pedigree {
  private readonly animals: ReadonlyMap<string, Readonly<AnimalInput>>;

  constructor(input: readonly AnimalInput[]) {
    const map = new Map<string, Readonly<AnimalInput>>();
    const issues: ValidationIssue[] = [];
    for (const a of input) {
      if (map.has(a.id)) {
        issues.push({ code: 'duplicate-id', animalId: a.id, message: `Duplicate animal id ${a.id}` });
        continue;
      }
      map.set(a.id, Object.freeze({ ...a, candidateSireIds: a.candidateSireIds ? [...a.candidateSireIds] : undefined }));
    }
    this.animals = map;
    issues.push(...this.validateLinks());
    if (issues.length === 0) {
      // Cycle check over the full graph.
      const cyc = findCycle(map, (id) => {
        const a = map.get(id);
        return [a?.sireId, a?.damId].filter((x): x is string => !!x && map.has(x));
      });
      if (cyc) {
        issues.push({
          code: 'circular-ancestry',
          animalId: cyc[0]!,
          message: `Circular ancestry: ${cyc.map((id) => labelOf(map, id)).join(' -> ')}`,
        });
      }
    }
    if (issues.length > 0) throw new PedigreeValidationError(issues);
  }

  has(id: string): boolean {
    return this.animals.has(id);
  }

  get(id: string): Readonly<AnimalInput> {
    const a = this.animals.get(id);
    if (!a) throw new Error(`Unknown animal ${id}`);
    return a;
  }

  label(id: string): string {
    return labelOf(this.animals, id);
  }

  allIds(): string[] {
    return [...this.animals.keys()].sort();
  }

  view(options: ViewOptions = {}): PedigreeView {
    return new PedigreeView(this, options);
  }

  private validateLinks(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const a of this.animals.values()) {
      for (const role of ['sire', 'dam'] as const) {
        const pid = role === 'sire' ? a.sireId : a.damId;
        if (!pid) continue;
        issues.push(...checkLink(this.animals, a, pid, role));
      }
      if (a.candidateSireIds && a.candidateSireIds.length > 0) {
        if (a.sireId) {
          issues.push({
            code: 'candidate-with-recorded-sire',
            animalId: a.id,
            message: `${labelOf(this.animals, a.id)} has a recorded sire and candidate sires; keep one`,
          });
        }
        for (const cid of a.candidateSireIds) {
          const c = this.animals.get(cid);
          if (!c) {
            issues.push({ code: 'missing-parent', animalId: a.id, message: `Candidate sire ${cid} of ${labelOf(this.animals, a.id)} is not in the pedigree` });
          } else if (c.sex !== 'male') {
            issues.push({ code: 'candidate-not-male', animalId: a.id, message: `Candidate sire ${labelOf(this.animals, cid)} is not male` });
          }
        }
      }
    }
    return issues;
  }
}

function checkLink(
  animals: ReadonlyMap<string, Readonly<AnimalInput>>,
  child: Readonly<AnimalInput>,
  parentId: string,
  role: 'sire' | 'dam',
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = labelOf(animals, child.id);
  if (parentId === child.id) {
    issues.push({ code: 'self-parent', animalId: child.id, message: `${name} cannot be its own ${role}` });
    return issues;
  }
  const p = animals.get(parentId);
  if (!p) {
    issues.push({ code: 'missing-parent', animalId: child.id, message: `${role} ${parentId} of ${name} is not in the pedigree` });
    return issues;
  }
  if (role === 'sire' && p.sex !== 'male') {
    issues.push({ code: 'sire-not-male', animalId: child.id, message: `Sire of ${name} (${labelOf(animals, parentId)}) is not male` });
  }
  if (role === 'dam' && p.sex !== 'female') {
    issues.push({ code: 'dam-not-female', animalId: child.id, message: `Dam of ${name} (${labelOf(animals, parentId)}) is not female` });
  }
  if (p.speciesId !== child.speciesId) {
    issues.push({ code: 'species-mismatch', animalId: child.id, message: `${role} of ${name} is a different species` });
  }
  if (p.orgId && child.orgId && p.orgId !== child.orgId) {
    issues.push({ code: 'org-mismatch', animalId: child.id, message: `${role} of ${name} belongs to another organization` });
  }
  if (
    p.birthDate && child.birthDate && !p.birthDateEstimated && !child.birthDateEstimated &&
    p.birthDate >= child.birthDate
  ) {
    issues.push({
      code: 'parent-born-after-child',
      animalId: child.id,
      message: `${role} of ${name} was born on or after ${name} (${p.birthDate} vs ${child.birthDate})`,
    });
  }
  return issues;
}

/**
 * Check a single proposed parent link before it is written, mirroring the
 * database trigger: field rules plus "would this create circular ancestry".
 */
export function checkParentLink(
  pedigree: Pedigree,
  childId: string,
  parentId: string,
  role: 'sire' | 'dam',
): ValidationIssue[] {
  const map = new Map<string, Readonly<AnimalInput>>();
  for (const id of pedigree.allIds()) map.set(id, pedigree.get(id));
  const child = map.get(childId);
  if (!child) {
    return [{ code: 'missing-parent', animalId: childId, message: `Animal ${childId} is not in the pedigree` }];
  }
  const issues = checkLink(map, child, parentId, role);
  if (issues.some((i) => i.code === 'self-parent' || i.code === 'missing-parent')) return issues;
  // Would childId become its own ancestor? True if childId is already an ancestor of parentId.
  const stack = [parentId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === childId) {
      issues.push({
        code: 'circular-ancestry',
        animalId: childId,
        message: `Making ${labelOf(map, parentId)} the ${role} of ${labelOf(map, childId)} would create circular ancestry`,
      });
      break;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const a = map.get(id);
    if (a?.sireId) stack.push(a.sireId);
    if (a?.damId) stack.push(a.damId);
  }
  return issues;
}

function labelOf(map: ReadonlyMap<string, Readonly<AnimalInput>>, id: string): string {
  return map.get(id)?.label ?? id;
}

/** Returns one cycle (as a list of ids) or null. Iterative DFS, deterministic order. */
function findCycle(
  map: ReadonlyMap<string, unknown>,
  parentsOf: (id: string) => string[],
): string[] | null {
  const state = new Map<string, 1 | 2>(); // 1 = on stack, 2 = done
  const ids = [...map.keys()].sort();
  for (const start of ids) {
    if (state.has(start)) continue;
    const stack: { id: string; next: number; parents: string[] }[] = [
      { id: start, next: 0, parents: parentsOf(start) },
    ];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      if (top.next < top.parents.length) {
        const p = top.parents[top.next++]!;
        const s = state.get(p);
        if (s === 1) {
          const from = stack.findIndex((f) => f.id === p);
          return [...stack.slice(from).map((f) => f.id), p];
        }
        if (s === undefined) {
          state.set(p, 1);
          stack.push({ id: p, next: 0, parents: parentsOf(p) });
        }
      } else {
        state.set(top.id, 2);
        stack.pop();
      }
    }
  }
  return null;
}

/**
 * A read-only window onto a pedigree with optional link filtering or sire
 * overrides. Provides a topological index (ancestors before descendants).
 */
export class PedigreeView {
  private readonly order = new Map<string, number>();
  private readonly parentCache = new Map<string, ResolvedParents>();

  constructor(
    readonly pedigree: Pedigree,
    private readonly options: ViewOptions,
  ) {
    const ids = pedigree.allIds();
    const cyc = findCycle(new Map(ids.map((id) => [id, true])), (id) => {
      const p = this.parents(id);
      return [p.sire?.parentId, p.dam?.parentId].filter((x): x is string => !!x);
    });
    if (cyc) {
      throw new PedigreeValidationError([
        {
          code: 'circular-ancestry',
          animalId: cyc[0]!,
          message: `Circular ancestry in scenario: ${cyc.map((id) => pedigree.label(id)).join(' -> ')}`,
        },
      ]);
    }
    // Post-order DFS gives parents a lower index than children.
    const visited = new Set<string>();
    let next = 0;
    for (const start of ids) {
      if (visited.has(start)) continue;
      const stack: { id: string; expanded: boolean }[] = [{ id: start, expanded: false }];
      while (stack.length) {
        const top = stack[stack.length - 1]!;
        if (visited.has(top.id) && !top.expanded) {
          stack.pop();
          continue;
        }
        if (!top.expanded) {
          top.expanded = true;
          visited.add(top.id);
          const p = this.parents(top.id);
          for (const pid of [p.dam?.parentId, p.sire?.parentId]) {
            if (pid && !visited.has(pid)) stack.push({ id: pid, expanded: false });
          }
        } else {
          this.order.set(top.id, next++);
          stack.pop();
        }
      }
    }
  }

  index(id: string): number {
    const i = this.order.get(id);
    if (i === undefined) throw new Error(`Unknown animal ${id}`);
    return i;
  }

  parents(id: string): ResolvedParents {
    const cached = this.parentCache.get(id);
    if (cached) return cached;
    const a = this.pedigree.get(id);
    const allowed = this.options.allowedConfidence;
    let sire: ParentLink | null = a.sireId
      ? { parentId: a.sireId, confidence: a.sireConfidence ?? 'reported' }
      : null;
    let dam: ParentLink | null = a.damId
      ? { parentId: a.damId, confidence: a.damConfidence ?? 'reported' }
      : null;
    const override = this.options.sireOverrides?.get(id);
    if (!sire && override) sire = { parentId: override, confidence: 'assumed' };
    if (allowed) {
      if (sire && !allowed.has(sire.confidence)) sire = null;
      if (dam && !allowed.has(dam.confidence)) dam = null;
    }
    const resolved = { sire, dam };
    this.parentCache.set(id, resolved);
    return resolved;
  }

  sireOf(id: string): string | null {
    return this.parents(id).sire?.parentId ?? null;
  }

  damOf(id: string): string | null {
    return this.parents(id).dam?.parentId ?? null;
  }

  /** The animal itself plus every ancestor reachable in this view. */
  ancestorsInclusive(id: string): Set<string> {
    const out = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (out.has(cur)) continue;
      out.add(cur);
      const s = this.sireOf(cur);
      const d = this.damOf(cur);
      if (s) stack.push(s);
      if (d) stack.push(d);
    }
    return out;
  }
}
