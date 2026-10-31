"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { BreedingError, runCheck } from "@/lib/breeding";
import { getOrgContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import {
  birthSchema,
  fieldErrors,
  kidSchema,
  matingCheckSchema,
  matingRecordSchema,
  pairingSchema,
  policySchema,
  pregnancyCheckSchema,
} from "@/lib/validation";

/*
 * Breeding actions. Checks run in the "breeding" Edge Function (the only
 * writer of assessments); records go through database RPCs that re-check
 * permission, freshness of the check, overrides and dates.
 */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const all = (fd: FormData, k: string) => fd.getAll(k).map(String).filter(Boolean);

function checkError(e: unknown): ActionState {
  if (e instanceof BreedingError) return { error: e.message };
  console.error(e);
  return { error: "The breeding check could not be completed, so no result is shown. Try again." };
}

/** Check one pairing and open the stored result. */
export async function checkPairingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = { buckId: str(fd, "buckId"), doeId: str(fd, "doeId") };
  const parsed = pairingSchema.safeParse({ orgId: str(fd, "orgId"), ...values });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  await getOrgContext(parsed.data.orgId);
  let id: string;
  try {
    id = (await runCheck(parsed.data.buckId, parsed.data.doeId, "check")).assessmentId;
  } catch (e) {
    return { ...checkError(e), values };
  }
  redirect(`/o/${parsed.data.orgId}/breeding/assessments/${id}`);
}

export type MatingCheck = {
  sireId: string;
  assessmentId: string;
  classification: string;
  possible: boolean;
  coi: string;
  worst: string | null;
  completeness: number;
  headline: string;
};

/**
 * Two steps on one form. "check": run a fresh check for every chosen buck and
 * return the results. "record": save the mating with those checks; the
 * database refuses stale checks, missing overrides and unacknowledged warnings.
 */
export async function matingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const intent = str(fd, "intent");
  const values: Record<string, string> = {
    doeId: str(fd, "doeId"),
    method: str(fd, "method"),
    buckIds: all(fd, "buckIds").join(","),
    startedOn: str(fd, "startedOn"),
    endedOn: str(fd, "endedOn"),
    notes: str(fd, "notes"),
    reason: str(fd, "reason"),
  };
  const orgId = str(fd, "orgId");

  if (intent === "check") {
    const parsed = matingCheckSchema.safeParse({ orgId, doeId: values.doeId, method: values.method, buckIds: all(fd, "buckIds") });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
    if (parsed.data.method !== "pasture" && parsed.data.buckIds.length > 1) {
      return { fieldErrors: { buckIds: ["Hand mating and AI use one buck. Choose “Running with the herd” for several."] }, values };
    }
    await getOrgContext(orgId);
    try {
      const checks: MatingCheck[] = [];
      for (const buckId of parsed.data.buckIds) {
        const r = await runCheck(buckId, parsed.data.doeId, "mating");
        const a = r.assessment;
        checks.push({
          sireId: buckId,
          assessmentId: r.assessmentId,
          classification: a.classification.code,
          possible: a.classification.possible,
          coi: a.knownCoi.display,
          worst: a.worstCaseCoi && a.worstCaseCoi.value > a.knownCoi.value ? a.worstCaseCoi.display : null,
          completeness: a.completeness.used,
          headline: a.explanation.at(-1) ?? "",
        });
      }
      return { ok: true, values, data: { checks: JSON.stringify(checks), checkedFor: `${parsed.data.doeId}|${parsed.data.method}|${parsed.data.buckIds.join(",")}` } };
    } catch (e) {
      return { ...checkError(e), values };
    }
  }

  let assessments: { sireId: string; assessmentId: string }[] = [];
  try {
    assessments = JSON.parse(str(fd, "assessments") || "[]");
  } catch {
    assessments = [];
  }
  const parsed = matingRecordSchema.safeParse({
    orgId,
    doeId: values.doeId,
    method: values.method,
    buckIds: all(fd, "buckIds"),
    startedOn: values.startedOn,
    endedOn: values.endedOn,
    notes: values.notes,
    reason: values.reason,
    acknowledged: bool(fd, "acknowledged"),
    assessments,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values, data: keep(fd) };
  const v = parsed.data;
  const chosen = new Set(v.buckIds);
  if (v.assessments.length !== chosen.size || v.assessments.some((a) => !chosen.has(a.sireId))) {
    return { error: "The bucks changed since the check. Run the check again.", values };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("record_mating", {
    p_dam: v.doeId,
    p_method: v.method,
    p_started_on: v.startedOn,
    p_ended_on: v.method === "pasture" ? v.endedOn : null,
    p_sires: v.assessments.map((a) => ({ sire_id: a.sireId, assessment_id: a.assessmentId })),
    p_override_reason: v.reason ?? undefined,
    p_risk_acknowledged: v.acknowledged,
    p_notes: v.notes ?? undefined,
  });
  if (error || !id) {
    const msg = error?.message ?? "";
    if (/reason of at least/.test(msg)) return { fieldErrors: { reason: [msg] }, values, data: keep(fd) };
    if (/Confirm that you have read/.test(msg)) return { fieldErrors: { acknowledged: ["Tick this to confirm you have read the warning"] }, values, data: keep(fd) };
    if (/out of date|already used|Run the breeding check/.test(msg)) return { error: `${msg}`, values };
    return { error: friendlyError(error, "Could not record the mating."), values, data: keep(fd) };
  }
  revalidatePath(`/o/${orgId}`, "layout");
  redirect(`/o/${orgId}/breeding/matings/${id}?saved=mating`);
}

/** Keep the check results on the form after a validation error at the record step. */
function keep(fd: FormData) {
  return { checks: str(fd, "checks"), checkedFor: str(fd, "checkedFor") };
}

export async function pregnancyCheckAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = {
    checkedOn: str(fd, "checkedOn"),
    method: str(fd, "method"),
    result: str(fd, "result"),
    dueOn: str(fd, "dueOn"),
    notes: str(fd, "notes"),
  };
  const parsed = pregnancyCheckSchema.safeParse({ orgId: str(fd, "orgId"), doeId: str(fd, "doeId"), matingId: str(fd, "matingId"), ...values });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_pregnancy_check", {
    p_dam: v.doeId,
    p_mating: v.matingId,
    p_checked_on: v.checkedOn,
    p_method: v.method,
    p_result: v.result,
    p_due_on: v.dueOn ?? undefined,
    p_notes: v.notes ?? undefined,
  });
  if (error) return { error: friendlyError(error, "Could not save the pregnancy check."), values };
  revalidatePath(`/o/${v.orgId}`, "layout");
  return { ok: true, message: "Pregnancy check saved." };
}

export async function birthAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const count = Math.min(8, Math.max(1, Number(str(fd, "kidCount")) || 1));
  const values: Record<string, string> = {
    doeId: str(fd, "doeId"),
    bornOn: str(fd, "bornOn"),
    breedId: str(fd, "breedId"),
    sireId: str(fd, "sireId"),
    sireConfidence: str(fd, "sireConfidence"),
    notes: str(fd, "notes"),
    kidCount: String(count),
    assisted: bool(fd, "assisted") ? "on" : "",
  };
  const kids = [];
  const errors: Record<string, string[]> = {};
  for (let i = 0; i < count; i++) {
    const raw = {
      alive: str(fd, `kid${i}.alive`) !== "stillborn",
      sex: str(fd, `kid${i}.sex`),
      tag: str(fd, `kid${i}.tag`),
      name: str(fd, `kid${i}.name`),
      weightKg: str(fd, `kid${i}.weightKg`),
    };
    values[`kid${i}.alive`] = raw.alive ? "alive" : "stillborn";
    values[`kid${i}.sex`] = raw.sex;
    values[`kid${i}.tag`] = raw.tag;
    values[`kid${i}.name`] = raw.name;
    values[`kid${i}.weightKg`] = raw.weightKg;
    const k = kidSchema.safeParse(raw);
    if (!k.success) {
      for (const [f, m] of Object.entries(fieldErrors(k.error))) if (m) errors[`kid${i}.${f}`] = m;
    } else kids.push(k.data);
  }
  const parsed = birthSchema.safeParse({
    orgId: str(fd, "orgId"),
    doeId: values.doeId,
    matingId: str(fd, "matingId"),
    bornOn: values.bornOn,
    breedId: values.breedId,
    sireId: values.sireId,
    sireConfidence: values.sireConfidence || "observed",
    assisted: bool(fd, "assisted"),
    notes: values.notes,
  });
  if (!parsed.success || Object.keys(errors).length) {
    return { fieldErrors: { ...(parsed.success ? {} : fieldErrors(parsed.error)), ...errors }, values };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("register_birth", {
    p_dam: v.doeId,
    p_mating: v.matingId,
    p_born_on: v.bornOn,
    p_kids: kids.map((k) => ({ alive: k.alive, sex: k.sex || null, tag: k.tag, name: k.name, weight_kg: k.weightKg ? Number(k.weightKg) : null })),
    p_breed: v.breedId ?? undefined,
    p_sire: v.sireId ?? undefined,
    p_sire_confidence: v.sireConfidence,
    p_assisted: v.assisted,
    p_notes: v.notes ?? undefined,
  });
  if (error || !id) {
    if (error?.code === "23505" && /animals_org_tag_key/.test(error.message)) {
      return { error: "One of the tags is already used by another animal.", values };
    }
    return { error: friendlyError(error, "Could not record the kidding."), values };
  }
  revalidatePath(`/o/${v.orgId}`, "layout");
  redirect(`/o/${v.orgId}/breeding/kiddings/${id}?saved=1`);
}

export async function policyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values: Record<string, string> = {};
  for (const k of ["lowBandMax", "highBandMin", "maxCoi", "minCompleteness", "generations", "advisorName", "advisorNote", "advisorConfirmedOn"]) {
    values[k] = str(fd, k);
  }
  const parsed = policySchema.safeParse({
    orgId: str(fd, "orgId"),
    ...values,
    blocked: all(fd, "blocked"),
    allowFounderAssumption: bool(fd, "allowFounderAssumption"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  const ctx = await getOrgContext(v.orgId);
  if (ctx.role !== "owner") return { error: "Only owners can change the breeding policy." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("breeding_policies")
    .update({
      low_band_max: v.lowBandMax,
      high_band_min: v.highBandMin,
      max_coi: v.maxCoi,
      min_completeness: v.minCompleteness,
      generations: v.generations,
      blocked_relationships: v.blocked,
      allow_founder_assumption: v.allowFounderAssumption,
      advisor_name: v.advisorName,
      advisor_note: v.advisorNote,
      advisor_confirmed_on: v.advisorConfirmedOn,
    })
    .eq("org_id", v.orgId)
    .eq("species_code", "goat")
    .select("advisor_confirmed_on");
  if (error) return { error: friendlyError(error, "Could not save the policy. Check the values."), values };
  if (!data?.length) return { error: "You don't have permission to do that.", values };
  revalidatePath(`/o/${v.orgId}`, "layout");
  const cleared = v.advisorConfirmedOn && !data[0]!.advisor_confirmed_on;
  return {
    ok: true,
    message: cleared ? "Saved. Thresholds changed, so the advisor confirmation was cleared." : "Breeding policy saved.",
  };
}
