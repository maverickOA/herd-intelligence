import "server-only";
import { notFound } from "next/navigation";
import type { PairingAssessment, RankResult } from "@herd/breeding-service";
import type { Enums, Tables } from "@/lib/database.types";
import { isUuid } from "@/lib/data";
import { GONE_STATUSES, animalLabel } from "@/lib/labels";
import { idsIn } from "@/lib/labelize";
import { createClient } from "@/lib/supabase/server";

/*
 * Breeding data access. Reads run as the signed-in user (Row Level Security
 * decides what appears). Breeding checks run in the Supabase "breeding" Edge
 * Function, which runs the pedigree engine on the full ancestry and stores the
 * result; the app never computes or writes an assessment itself.
 */

export type Assessment = Tables<"breeding_assessments">;
export type Policy = Tables<"breeding_policies">;
export type BreedingClass = Enums<"breeding_class">;
export type { PairingAssessment, RankResult };

export class BreedingError extends Error {}

type FunctionResult =
  | { action: "assess"; assessmentId: string; assessment: PairingAssessment }
  | { action: "rank"; result: RankResult };

async function callBreeding(body: Record<string, unknown>): Promise<FunctionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<FunctionResult>("breeding", { body });
  if (error) {
    let message = "The breeding check could not be completed, so no result is shown. Try again.";
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      try {
        const j = (await ctx.json()) as { error?: string };
        if (j.error) message = j.error;
      } catch {
        /* keep the default */
      }
    }
    throw new BreedingError(message);
  }
  if (!data) throw new BreedingError("The breeding check returned nothing, so no result is shown. Try again.");
  return data;
}

/** Run and store a breeding check. Returns the stored assessment's id. */
export async function runCheck(buckId: string, doeId: string, purpose: "check" | "mating" = "check") {
  const r = await callBreeding({ action: "assess", buckId, doeId, purpose });
  if (r.action !== "assess") throw new BreedingError("Unexpected reply from the breeding check.");
  return r;
}

/** Rank every eligible buck the user can see for one doe (not stored). */
export async function rankBucks(doeId: string) {
  const r = await callBreeding({ action: "rank", doeId });
  if (r.action !== "rank") throw new BreedingError("Unexpected reply from the breeding check.");
  return r.result;
}

export async function getPolicy(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("breeding_policies")
    .select("*")
    .eq("org_id", orgId)
    .eq("species_code", "goat")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSpecies() {
  const supabase = await createClient();
  const { data } = await supabase.from("species").select("code, gestation_days").eq("code", "goat").single();
  return { gestationDays: data?.gestation_days ?? 150 };
}

type AnimalRef = { id: string; tag: string | null; name: string | null; registration_number: string | null; sex: Enums<"animal_sex"> };

/** Labels for the animals the user can see; others stay out of the map. */
export async function labelsFor(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(isUuid))];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("animals").select("id, tag, name, registration_number").in("id", unique);
  return new Map((data ?? []).map((a) => [a.id, animalLabel(a)]));
}

export { idsIn, labelize } from "@/lib/labelize";

export async function getAssessment(orgId: string, id: string) {
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("breeding_assessments").select("*").eq("org_id", orgId).eq("id", id).maybeSingle();
  if (!data) notFound();
  const [labels, { data: override }, { data: profile }] = await Promise.all([
    labelsFor(idsIn(data.result)),
    supabase.from("assessment_overrides").select("reason, approver_role, created_at, approved_by").eq("assessment_id", id).maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("id", data.requested_by).maybeSingle(),
  ]);
  return {
    assessment: data,
    result: data.result as unknown as PairingAssessment,
    labels,
    override,
    requestedBy: profile?.full_name ?? profile?.email ?? "A team member",
  };
}

export async function getRecentAssessments(orgId: string, limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("breeding_assessments")
    .select("id, buck_id, doe_id, classification, possible, classified_coi, completeness, created_at, purpose")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Does and bucks that can be chosen for breeding, as the user sees them. */
export async function getBreedingAnimals(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("animals")
    .select("id, tag, name, registration_number, sex, status, origin, farm_id, breed_id, birth_date")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .not("status", "in", `(${GONE_STATUSES.join(",")})`)
    .order("tag", { ascending: true, nullsFirst: false })
    .order("name")
    .limit(1000);
  if (error) throw error;
  const all = (data ?? []).map((a) => ({ ...a, label: animalLabel(a) }));
  return {
    does: all.filter((a) => a.sex === "female" && a.farm_id),
    bucks: all.filter((a) => a.sex === "male" && a.status !== "quarantined"),
  };
}

export type Mating = Tables<"mating_events">;

export type MatingRow = Mating & {
  dam: AnimalRef | null;
  sires: { sireId: string; label: string | null; assessmentId: string; classification: BreedingClass | null; overridden: boolean }[];
  dueFrom: string;
  dueTo: string;
  scanDue: string | null;
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Matings with their sires, check results and the estimated due window. */
export async function getMatings(orgId: string, opts: { damId?: string; sireId?: string; outcomes?: Enums<"mating_outcome">[]; limit?: number } = {}) {
  const supabase = await createClient();
  let mIds: string[] | null = null;
  if (opts.sireId) {
    const { data } = await supabase.from("mating_event_sires").select("mating_id").eq("sire_id", opts.sireId);
    mIds = (data ?? []).map((r) => r.mating_id);
    if (!mIds.length) return [];
  }
  let q = supabase.from("mating_events").select("*").eq("org_id", orgId);
  if (opts.damId) q = q.eq("dam_id", opts.damId);
  if (mIds) q = q.in("id", mIds);
  if (opts.outcomes) q = q.in("outcome", opts.outcomes);
  const { data: matings, error } = await q.order("started_on", { ascending: false }).limit(opts.limit ?? 200);
  if (error) throw error;
  return withDetails(matings ?? []);
}

async function withDetails(matings: Mating[]): Promise<MatingRow[]> {
  if (!matings.length) return [];
  const supabase = await createClient();
  const ids = matings.map((m) => m.id);
  const [{ data: sires }, { data: checks }, { gestationDays }] = await Promise.all([
    supabase.from("mating_event_sires").select("mating_id, sire_id, assessment_id, override_id").in("mating_id", ids),
    supabase.from("pregnancy_checks").select("mating_id, due_on, result, checked_on").in("mating_id", ids).order("checked_on", { ascending: false }),
    getSpecies(),
  ]);
  const assessmentIds = (sires ?? []).map((s) => s.assessment_id);
  const [{ data: assessments }, animals] = await Promise.all([
    assessmentIds.length
      ? supabase.from("breeding_assessments").select("id, classification").in("id", assessmentIds)
      : Promise.resolve({ data: [] as { id: string; classification: BreedingClass }[] }),
    (async () => {
      const animalIds = [...matings.map((m) => m.dam_id), ...(sires ?? []).map((s) => s.sire_id)];
      const { data } = await supabase.from("animals").select("id, tag, name, registration_number, sex").in("id", [...new Set(animalIds)]);
      return new Map((data ?? []).map((a) => [a.id, a]));
    })(),
  ]);
  const cls = new Map((assessments ?? []).map((a) => [a.id, a.classification]));
  return matings.map((m) => {
    const scan = (checks ?? []).find((c) => c.mating_id === m.id && c.result === "pregnant" && c.due_on);
    return {
      ...m,
      dam: animals.get(m.dam_id) ?? null,
      sires: (sires ?? [])
        .filter((s) => s.mating_id === m.id)
        .map((s) => {
          const a = animals.get(s.sire_id);
          return {
            sireId: s.sire_id,
            label: a ? animalLabel(a) : null,
            assessmentId: s.assessment_id,
            classification: cls.get(s.assessment_id) ?? null,
            overridden: !!s.override_id,
          };
        }),
      dueFrom: addDays(m.started_on, gestationDays),
      dueTo: addDays(m.ended_on ?? m.started_on, gestationDays),
      scanDue: scan?.due_on ?? null,
    };
  });
}

export async function getMating(orgId: string, id: string) {
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("mating_events").select("*").eq("org_id", orgId).eq("id", id).maybeSingle();
  if (!data) notFound();
  const [[row], { data: checks }, { data: birth }] = await Promise.all([
    withDetails([data]),
    supabase.from("pregnancy_checks").select("*").eq("mating_id", id).order("checked_on", { ascending: false }),
    supabase.from("birth_events").select("*").eq("mating_id", id).maybeSingle(),
  ]);
  return { mating: row!, checks: checks ?? [], birth: birth ?? null };
}

export async function getBirth(orgId: string, id: string) {
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: birth } = await supabase.from("birth_events").select("*").eq("org_id", orgId).eq("id", id).maybeSingle();
  if (!birth) notFound();
  const { data: offspring } = await supabase.from("birth_offspring").select("*").eq("birth_id", id).order("position");
  const labels = await labelsFor([birth.dam_id, ...(offspring ?? []).map((o) => o.animal_id ?? "")]);
  return { birth, offspring: offspring ?? [], labels };
}

export async function getRecentBirths(orgId: string, limit = 10) {
  const supabase = await createClient();
  const { data: births } = await supabase
    .from("birth_events")
    .select("id, dam_id, born_on, mating_id")
    .eq("org_id", orgId)
    .order("born_on", { ascending: false })
    .limit(limit);
  if (!births?.length) return [];
  const { data: offspring } = await supabase.from("birth_offspring").select("birth_id, born_alive").in("birth_id", births.map((b) => b.id));
  const labels = await labelsFor(births.map((b) => b.dam_id));
  return births.map((b) => {
    const kids = (offspring ?? []).filter((o) => o.birth_id === b.id);
    return { ...b, dam: labels.get(b.dam_id) ?? "Doe", alive: kids.filter((k) => k.born_alive).length, stillborn: kids.filter((k) => !k.born_alive).length };
  });
}

export async function getCandidateSires(childId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("animal_candidate_sires").select("sire_id").eq("child_id", childId);
  const ids = (data ?? []).map((r) => r.sire_id);
  const labels = await labelsFor(ids);
  return ids.map((id) => ({ id, label: labels.get(id) ?? null }));
}
