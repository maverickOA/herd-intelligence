"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { getOrgContext } from "@/lib/data";
import { canEditAnimal } from "@/lib/herd";
import { createClient } from "@/lib/supabase/server";
import { acquisitionSchema, editAnimalSchema, fieldErrors, newAnimalSchema, setParentSchema } from "@/lib/validation";

/*
 * Herd mutations. They run as the signed-in user; Row Level Security and the
 * pedigree triggers in the database have the final say, and their messages
 * (e.g. "P-D is female, so it cannot be a sire") are shown as written.
 */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const money = (v: string | null) => (v === null ? null : Number(v.replace(/,/g, "")));

const ANIMAL_FIELDS = [
  "tag", "name", "registrationNumber", "sex", "breedId", "birthDate", "color", "markings", "notes", "farmId", "penId",
  "status", "origin", "sireId", "damId", "parentConfidence", "acquiredOn", "source", "price", "childOf", "childRole",
];

function echo(fd: FormData) {
  const values: Record<string, string> = {};
  for (const k of ANIMAL_FIELDS) values[k] = str(fd, k);
  values.birthDateEstimated = bool(fd, "birthDateEstimated") ? "on" : "";
  values.isDeclaredFounder = bool(fd, "isDeclaredFounder") ? "on" : "";
  return values;
}

/** Map database messages for animals to field-level errors where we can. */
function animalError(error: { code?: string; message?: string }) {
  if (error.code === "23505" && /animals_org_tag_key/.test(error.message ?? "")) {
    return { fieldErrors: { tag: ["Another animal already has this tag"] } };
  }
  if (/future/i.test(error.message ?? "")) return { fieldErrors: { birthDate: ["Birth date cannot be in the future"] } };
  if (/pens_id_farm|pen_id_farm_id/.test(error.message ?? "")) return { fieldErrors: { penId: ["That pen is on another farm"] } };
  return { error: friendlyError(error, "Could not save the animal. Please check the details and try again.") };
}

export async function registerAnimal(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = echo(fd);
  const parsed = newAnimalSchema.safeParse({
    orgId: str(fd, "orgId"),
    origin: str(fd, "origin"),
    tag: str(fd, "tag"),
    name: str(fd, "name"),
    registrationNumber: str(fd, "registrationNumber"),
    sex: str(fd, "sex"),
    breedId: str(fd, "breedId"),
    birthDate: str(fd, "birthDate"),
    birthDateEstimated: bool(fd, "birthDateEstimated"),
    color: str(fd, "color"),
    markings: str(fd, "markings"),
    notes: str(fd, "notes"),
    isDeclaredFounder: bool(fd, "isDeclaredFounder"),
    farmId: str(fd, "farmId"),
    penId: str(fd, "penId"),
    status: str(fd, "status") || "active",
    sireId: str(fd, "sireId"),
    damId: str(fd, "damId"),
    parentConfidence: str(fd, "parentConfidence") || "reported",
    acquiredOn: str(fd, "acquiredOn"),
    source: str(fd, "source"),
    price: str(fd, "price"),
    childOf: str(fd, "childOf"),
    childRole: str(fd, "childRole"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  const ctx = await getOrgContext(v.orgId);
  const recordOnly = v.origin === "pedigree_only";
  const farmId = recordOnly ? null : v.farmId;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("animals")
    .insert({
      org_id: v.orgId,
      farm_id: farmId,
      pen_id: recordOnly ? null : v.penId,
      origin: v.origin,
      tag: v.tag,
      name: v.name,
      registration_number: v.registrationNumber,
      sex: v.sex,
      breed_id: v.breedId,
      birth_date: v.birthDate,
      birth_date_estimated: v.birthDate ? v.birthDateEstimated : false,
      status: recordOnly ? "active" : v.status,
      is_declared_founder: v.isDeclaredFounder,
      color: v.color,
      markings: v.markings,
      notes: v.notes,
    })
    .select("id")
    .single();
  if (error || !created) return { ...animalError(error ?? {}), values };

  const warnings: string[] = [];
  const editor = canEditAnimal(ctx, farmId);

  // Parents chosen on the form.
  if (editor) {
    for (const [role, parentId] of [["sire", v.sireId], ["dam", v.damId]] as const) {
      if (!parentId) continue;
      const { error: pe } = await supabase.rpc("set_parent", {
        p_child: created.id,
        p_role: role,
        p_parent: parentId,
        p_confidence: v.parentConfidence,
      });
      if (pe) warnings.push(`The ${role} wasn't saved: ${friendlyError(pe, "it could not be linked.")}`);
    }
  }

  // Purchase details (owners and managers only).
  if (editor && v.origin !== "born_on_farm" && !recordOnly && (v.acquiredOn || v.source || v.price)) {
    const { error: ae } = await supabase.from("animal_acquisitions").insert({
      animal_id: created.id,
      org_id: v.orgId,
      acquired_on: v.acquiredOn,
      source: v.source,
      price: money(v.price),
      currency_code: v.price ? ctx.org.currency_code : null,
    });
    if (ae) warnings.push(`Purchase details weren't saved: ${friendlyError(ae)}`);
  }

  // Added as an ancestor from another animal's profile: link it straight away.
  let goTo = created.id;
  if (v.childOf && v.childRole) {
    const { error: le } = await supabase.rpc("set_parent", {
      p_child: v.childOf,
      p_role: v.childRole,
      p_parent: created.id,
      p_confidence: v.parentConfidence,
      p_evidence: "From seller's papers",
    });
    if (le) warnings.push(`Added, but not linked as ${v.childRole}: ${friendlyError(le, "the link was refused.")}`);
    goTo = v.childOf;
  }

  revalidatePath(`/o/${v.orgId}`, "layout");
  const qs = new URLSearchParams();
  if (warnings.length) qs.set("warning", warnings.join(" "));
  else qs.set("saved", v.childOf ? "ancestor" : "registered");
  redirect(`/o/${v.orgId}/herd/${goTo}?${qs}`);
}

export async function updateAnimal(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = echo(fd);
  const parsed = editAnimalSchema.safeParse({
    orgId: str(fd, "orgId"),
    animalId: str(fd, "animalId"),
    isRecordOnly: fd.get("isRecordOnly") === "true",
    tag: str(fd, "tag"),
    name: str(fd, "name"),
    registrationNumber: str(fd, "registrationNumber"),
    sex: str(fd, "sex"),
    breedId: str(fd, "breedId"),
    birthDate: str(fd, "birthDate"),
    birthDateEstimated: bool(fd, "birthDateEstimated"),
    color: str(fd, "color"),
    markings: str(fd, "markings"),
    notes: str(fd, "notes"),
    isDeclaredFounder: bool(fd, "isDeclaredFounder"),
    farmId: str(fd, "farmId"),
    penId: str(fd, "penId"),
    status: str(fd, "status") || "active",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("animals")
    .update({
      tag: v.tag,
      name: v.name,
      registration_number: v.registrationNumber,
      sex: v.sex,
      breed_id: v.breedId,
      birth_date: v.birthDate,
      birth_date_estimated: v.birthDate ? v.birthDateEstimated : false,
      color: v.color,
      markings: v.markings,
      notes: v.notes,
      is_declared_founder: v.isDeclaredFounder,
      ...(v.isRecordOnly ? {} : { farm_id: v.farmId, pen_id: v.penId, status: v.status }),
    })
    .eq("id", v.animalId)
    .eq("org_id", v.orgId)
    .select("id");
  if (error) return { ...animalError(error), values };
  if (!data?.length) return { error: "You don't have permission to edit this animal.", values };
  revalidatePath(`/o/${v.orgId}`, "layout");
  redirect(`/o/${v.orgId}/herd/${v.animalId}?saved=updated`);
}

export async function setParentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = setParentSchema.safeParse({
    orgId: str(fd, "orgId"),
    childId: str(fd, "childId"),
    role: str(fd, "role"),
    parentId: str(fd, "parentId"),
    confidence: str(fd, "confidence") || "reported",
    evidence: str(fd, "evidence"),
  });
  if (!parsed.success) return { error: "Please check the choice and try again." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_parent", {
    p_child: v.childId,
    p_role: v.role,
    // The generated type marks it required; null clears the link.
    p_parent: v.parentId as string,
    p_confidence: v.confidence,
    p_evidence: v.evidence ?? undefined,
  });
  if (error) return { error: friendlyError(error, "Could not save the parent.") };
  revalidatePath(`/o/${v.orgId}`, "layout");
  const word = v.role === "sire" ? "Sire" : "Dam";
  return { ok: true, message: v.parentId ? `${word} saved.` : `${word} removed. The old link is kept in the history.` };
}

export async function saveAcquisition(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = { acquiredOn: str(fd, "acquiredOn"), source: str(fd, "source"), price: str(fd, "price"), notes: str(fd, "notes") };
  const parsed = acquisitionSchema.safeParse({ orgId: str(fd, "orgId"), animalId: str(fd, "animalId"), ...values });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  const ctx = await getOrgContext(v.orgId);
  const supabase = await createClient();
  const row = {
    acquired_on: v.acquiredOn,
    source: v.source,
    price: money(v.price),
    currency_code: v.price ? ctx.org.currency_code : null,
    notes: v.notes,
  };
  const { data: existing } = await supabase.from("animal_acquisitions").select("animal_id").eq("animal_id", v.animalId).maybeSingle();
  const { error } = existing
    ? await supabase.from("animal_acquisitions").update(row).eq("animal_id", v.animalId)
    : await supabase.from("animal_acquisitions").insert({ ...row, animal_id: v.animalId, org_id: v.orgId });
  if (error) return { error: friendlyError(error), values };
  revalidatePath(`/o/${v.orgId}/herd/${v.animalId}`);
  return { ok: true, message: "Purchase details saved." };
}
