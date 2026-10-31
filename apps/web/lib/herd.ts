import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Enums, Tables } from "@/lib/database.types";
import { isUuid, type OrgContext } from "@/lib/data";
import { GONE_STATUSES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

/*
 * Herd data access. Every query runs as the signed-in user, so Row Level
 * Security decides which animals, parent links and purchase details appear.
 */

export type Animal = Tables<"animals">;

/** Mirrors app.can_edit_animal(): owners; managers of the animal's farm; any manager for records-only ancestors. */
export function canEditAnimal(ctx: OrgContext, farmId: string | null) {
  if (ctx.role === "owner") return true;
  if (ctx.role !== "manager") return false;
  return farmId === null || ctx.assignedFarmIds.includes(farmId);
}

/** Mirrors app.can_work_farm(): who may register animals on a farm. */
export function canRegisterOn(ctx: OrgContext, farmId: string) {
  return ctx.role === "owner" || ((ctx.role === "manager" || ctx.role === "worker") && ctx.assignedFarmIds.includes(farmId));
}

export const getBreeds = cache(async (orgId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("breeds")
    .select("id, name, org_id")
    .eq("species_code", "goat")
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order("name");
  if (error) throw error;
  return data ?? [];
});

export const getFarmsAndPens = cache(async (orgId: string) => {
  const supabase = await createClient();
  const [{ data: farms, error }, { data: pens }] = await Promise.all([
    supabase.from("farms").select("id, name").eq("org_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("pens").select("id, name, farm_id").eq("org_id", orgId).is("deleted_at", null).order("name"),
  ]);
  if (error) throw error;
  return { farms: farms ?? [], pens: pens ?? [] };
});

export type HerdFilter = {
  q?: string;
  sex?: Enums<"animal_sex">;
  view?: "herd" | "gone" | "records" | "all";
  farm?: string;
};

export async function getAnimals(orgId: string, f: HerdFilter = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("animals")
    .select("id, tag, name, registration_number, sex, status, origin, birth_date, birth_date_estimated, is_declared_founder, breed_id, farm_id, pen_id")
    .eq("org_id", orgId)
    .is("deleted_at", null);

  const view = f.view ?? "herd";
  if (view === "herd") query = query.not("farm_id", "is", null).not("status", "in", `(${GONE_STATUSES.join(",")})`);
  if (view === "gone") query = query.in("status", GONE_STATUSES).not("farm_id", "is", null);
  if (view === "records") query = query.is("farm_id", null);
  if (f.sex) query = query.eq("sex", f.sex);
  if (f.farm && isUuid(f.farm)) query = query.eq("farm_id", f.farm);
  const q = f.q?.replace(/[,()%*\\]/g, " ").trim();
  if (q) query = query.or(`tag.ilike.%${q}%,name.ilike.%${q}%,registration_number.ilike.%${q}%`);

  const { data, error } = await query.order("tag", { ascending: true, nullsFirst: false }).order("name").limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function countAnimals(orgId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("animals")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .not("farm_id", "is", null)
    .not("status", "in", `(${GONE_STATUSES.join(",")})`);
  return count ?? 0;
}

export async function getAnimal(orgId: string, animalId: string) {
  if (!isUuid(animalId)) notFound();
  const supabase = await createClient();
  const { data: animal } = await supabase
    .from("animals")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", animalId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!animal) notFound();
  return animal;
}

export type ParentLink = {
  role: Enums<"parent_role">;
  confidence: Enums<"parent_confidence">;
  evidence: string | null;
  parent: Pick<Animal, "id" | "tag" | "name" | "registration_number" | "sex" | "origin" | "is_declared_founder"> | null;
  parentId: string;
};

export type AnimalDetail = Awaited<ReturnType<typeof getAnimalDetail>>;

export async function getAnimalDetail(orgId: string, animalId: string, withAcquisition: boolean) {
  const animal = await getAnimal(orgId, animalId);
  const supabase = await createClient();
  const [parentRows, offspringRows, events, acquisition, breeds, places] = await Promise.all([
    supabase
      .from("animal_parentage")
      .select("role, confidence, evidence, parent_id")
      .eq("child_id", animalId)
      .eq("is_current", true),
    supabase.from("animal_parentage").select("child_id, role").eq("parent_id", animalId).eq("is_current", true),
    supabase
      .from("animal_events")
      .select("id, event_type, summary, occurred_at")
      .eq("animal_id", animalId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50),
    withAcquisition
      ? supabase.from("animal_acquisitions").select("*").eq("animal_id", animalId).maybeSingle()
      : Promise.resolve({ data: null }),
    getBreeds(orgId),
    getFarmsAndPens(orgId),
  ]);

  const relatedIds = [
    ...(parentRows.data ?? []).map((p) => p.parent_id),
    ...(offspringRows.data ?? []).map((o) => o.child_id),
  ];
  const { data: related } = relatedIds.length
    ? await supabase
        .from("animals")
        .select("id, tag, name, registration_number, sex, origin, is_declared_founder, status, birth_date, birth_date_estimated")
        .in("id", relatedIds)
    : { data: [] };
  const byId = new Map((related ?? []).map((r) => [r.id, r]));

  const parents: ParentLink[] = (parentRows.data ?? []).map((p) => ({
    role: p.role,
    confidence: p.confidence,
    evidence: p.evidence,
    parentId: p.parent_id,
    parent: byId.get(p.parent_id) ?? null,
  }));
  const offspring = (offspringRows.data ?? [])
    .map((o) => byId.get(o.child_id))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => (a.birth_date ?? "").localeCompare(b.birth_date ?? ""));

  return {
    animal,
    sire: parents.find((p) => p.role === "sire") ?? null,
    dam: parents.find((p) => p.role === "dam") ?? null,
    offspring,
    events: events.data ?? [],
    acquisition: acquisition.data,
    breed: breeds.find((b) => b.id === animal.breed_id) ?? null,
    farm: places.farms.find((f) => f.id === animal.farm_id) ?? null,
    pen: places.pens.find((p) => p.id === animal.pen_id) ?? null,
  };
}

export type PedigreeNode = {
  id: string | null;
  label: string | null;
  sex: Enums<"animal_sex"> | null;
  confidence: Enums<"parent_confidence"> | null;
  isFounder: boolean;
  hidden: boolean;
};

/**
 * Ancestors up to `generations` back, as a binary tree in breadth-first order:
 * index 0 = the animal, children of i at 2i+1 (sire) and 2i+2 (dam).
 */
export async function getPedigree(rootId: string, generations = 3): Promise<PedigreeNode[]> {
  const supabase = await createClient();
  const size = 2 ** (generations + 1) - 1;
  const nodes: PedigreeNode[] = Array.from({ length: size }, () => ({
    id: null,
    label: null,
    sex: null,
    confidence: null,
    isFounder: false,
    hidden: false,
  }));
  const describe = async (ids: string[]) => {
    if (!ids.length) return new Map<string, Pick<Animal, "id" | "tag" | "name" | "registration_number" | "sex" | "is_declared_founder">>();
    const { data } = await supabase
      .from("animals")
      .select("id, tag, name, registration_number, sex, is_declared_founder")
      .in("id", ids);
    return new Map((data ?? []).map((a) => [a.id, a]));
  };

  const root = (await describe([rootId])).get(rootId);
  nodes[0] = {
    id: rootId,
    label: root ? labelOf(root) : null,
    sex: root?.sex ?? null,
    confidence: null,
    isFounder: !!root?.is_declared_founder,
    hidden: !root,
  };

  for (let g = 0; g < generations; g++) {
    const start = 2 ** g - 1;
    const level = nodes.slice(start, start + 2 ** g).map((n, i) => ({ n, i: start + i })).filter((x) => x.n.id && !x.n.hidden);
    if (!level.length) break;
    const { data: links } = await supabase
      .from("animal_parentage")
      .select("child_id, parent_id, role, confidence")
      .in("child_id", level.map((x) => x.n.id!))
      .eq("is_current", true);
    const info = await describe((links ?? []).map((l) => l.parent_id));
    for (const { n, i } of level) {
      for (const l of (links ?? []).filter((x) => x.child_id === n.id)) {
        const slot = 2 * i + (l.role === "sire" ? 1 : 2);
        const a = info.get(l.parent_id);
        nodes[slot] = {
          id: l.parent_id,
          label: a ? labelOf(a) : null,
          sex: a?.sex ?? null,
          confidence: l.confidence,
          isFounder: !!a?.is_declared_founder,
          hidden: !a,
        };
      }
    }
  }
  return nodes;
}

function labelOf(a: { tag: string | null; name: string | null; registration_number: string | null }) {
  if (a.tag && a.name) return `${a.tag} · ${a.name}`;
  return a.tag ?? a.name ?? a.registration_number ?? "Unnamed";
}

/** Animals that can be chosen as a sire or dam (all sexes returned; the form filters). */
export async function getParentOptions(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("animals")
    .select("id, tag, name, registration_number, sex, origin, status")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("tag", { ascending: true, nullsFirst: false })
    .order("name")
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((a) => ({ id: a.id, sex: a.sex, label: labelOf(a) + (a.origin === "pedigree_only" ? " (records only)" : "") }));
}

/** Mirrors app.can_record_breeding(): owners; assigned managers, workers and vets. */
export function canRecordBreeding(ctx: OrgContext, farmId: string | null) {
  if (!farmId) return false;
  return ctx.role === "owner" || ctx.assignedFarmIds.includes(farmId);
}

/** Mirrors app.can_manage_farm(): who may approve a restricted pairing. */
export function canApproveRestricted(ctx: OrgContext, farmId: string | null) {
  if (ctx.role === "owner") return true;
  return ctx.role === "manager" && !!farmId && ctx.assignedFarmIds.includes(farmId);
}
