"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { Constants } from "@/lib/database.types";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import {
  farmSchema,
  farmUpdateSchema,
  fieldErrors,
  inviteSchema,
  orgSettingsSchema,
  penSchema,
  penUpdateSchema,
  profileSchema,
  uuid,
} from "@/lib/validation";

/*
 * All mutations run with the signed-in user's session. Row Level Security and
 * column grants decide whether they succeed; the checks here only produce
 * friendlier messages. An update that matches no row is reported as a
 * permission problem rather than silently "succeeding".
 */

const form = (fd: FormData, key: string) => String(fd.get(key) ?? "");

function refresh(orgId: string) {
  revalidatePath(`/o/${orgId}`, "layout");
}

const NO_ROW = "You don't have permission to do that, or it no longer exists.";

// ---------------------------------------------------------------- Farms

export async function addFarm(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = { name: form(fd, "name"), address: form(fd, "address") };
  const parsed = farmSchema.safeParse({ orgId: form(fd, "orgId"), ...values });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farms")
    .insert({ org_id: parsed.data.orgId, name: parsed.data.name, address: parsed.data.address ?? null })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error), values };
  refresh(parsed.data.orgId);
  redirect(`/o/${parsed.data.orgId}/farms/${data.id}`);
}

export async function updateFarm(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = { name: form(fd, "name"), address: form(fd, "address") };
  const parsed = farmUpdateSchema.safeParse({ orgId: form(fd, "orgId"), farmId: form(fd, "farmId"), ...values });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farms")
    .update({ name: parsed.data.name, address: parsed.data.address ?? null })
    .eq("id", parsed.data.farmId)
    .eq("org_id", parsed.data.orgId)
    .select("id");
  if (error) return { error: friendlyError(error), values };
  if (!data?.length) return { error: NO_ROW, values };
  refresh(parsed.data.orgId);
  return { ok: true, message: "Farm details saved." };
}

// ---------------------------------------------------------------- Pens

export async function addPen(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = { name: form(fd, "name"), penType: form(fd, "penType"), capacity: form(fd, "capacity") };
  const parsed = penSchema.safeParse({ orgId: form(fd, "orgId"), farmId: form(fd, "farmId"), ...values });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { error } = await supabase.from("pens").insert({
    org_id: parsed.data.orgId,
    farm_id: parsed.data.farmId,
    name: parsed.data.name,
    pen_type: parsed.data.penType,
    capacity: parsed.data.capacity,
  });
  if (error) return { error: friendlyError(error), values };
  refresh(parsed.data.orgId);
  return { ok: true, message: `Added ${parsed.data.name}.` };
}

export async function updatePen(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = { name: form(fd, "name"), penType: form(fd, "penType"), capacity: form(fd, "capacity") };
  const parsed = penUpdateSchema.safeParse({
    orgId: form(fd, "orgId"),
    farmId: form(fd, "farmId"),
    penId: form(fd, "penId"),
    ...values,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pens")
    .update({ name: parsed.data.name, pen_type: parsed.data.penType, capacity: parsed.data.capacity })
    .eq("id", parsed.data.penId)
    .eq("org_id", parsed.data.orgId)
    .select("id");
  if (error) return { error: friendlyError(error), values };
  if (!data?.length) return { error: NO_ROW, values };
  refresh(parsed.data.orgId);
  return { ok: true, message: "Pen saved." };
}

export async function archivePen(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({ orgId: uuid, penId: uuid }).safeParse({ orgId: form(fd, "orgId"), penId: form(fd, "penId") });
  if (!parsed.success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pens")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.penId)
    .eq("org_id", parsed.data.orgId)
    .select("name");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: NO_ROW };
  refresh(parsed.data.orgId);
  return { ok: true, message: `Archived ${data[0]!.name}.` };
}

// ---------------------------------------------------------------- Team

export async function inviteMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = { email: form(fd, "email"), role: form(fd, "role") };
  const parsed = inviteSchema.safeParse({
    orgId: form(fd, "orgId"),
    email: values.email,
    role: values.role,
    farmIds: fd.getAll("farmIds").map(String),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_org: parsed.data.orgId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_farm_ids: parsed.data.role === "owner" ? [] : parsed.data.farmIds,
  });
  if (error || !token) return { error: friendlyError(error), values };
  refresh(parsed.data.orgId);
  return {
    ok: true,
    message: `Invitation ready for ${parsed.data.email}. Share the link below; it works once and expires in 7 days.`,
    data: { link: `${await siteUrl()}/invite/${token}`, email: parsed.data.email },
  };
}

export async function revokeInvitation(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({ orgId: uuid, invitationId: uuid }).safeParse({
    orgId: form(fd, "orgId"),
    invitationId: form(fd, "invitationId"),
  });
  if (!parsed.success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.invitationId)
    .eq("org_id", parsed.data.orgId)
    .select("email");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: NO_ROW };
  refresh(parsed.data.orgId);
  return { ok: true, message: `Invitation for ${data[0]!.email} cancelled.` };
}

export async function changeRole(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z
    .object({ orgId: uuid, membershipId: uuid, role: z.enum(Constants.public.Enums.member_role) })
    .safeParse({ orgId: form(fd, "orgId"), membershipId: form(fd, "membershipId"), role: form(fd, "role") });
  if (!parsed.success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.membershipId)
    .eq("org_id", parsed.data.orgId)
    .select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: NO_ROW };
  refresh(parsed.data.orgId);
  return { ok: true, message: "Role updated." };
}

export async function setMemberStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z
    .object({ orgId: uuid, membershipId: uuid, status: z.enum(Constants.public.Enums.member_status) })
    .safeParse({ orgId: form(fd, "orgId"), membershipId: form(fd, "membershipId"), status: form(fd, "status") });
  if (!parsed.success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.membershipId)
    .eq("org_id", parsed.data.orgId)
    .select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: NO_ROW };
  refresh(parsed.data.orgId);
  return { ok: true, message: parsed.data.status === "suspended" ? "Access paused." : "Access restored." };
}

export async function removeMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ orgId: uuid, membershipId: uuid }).safeParse({
    orgId: form(fd, "orgId"),
    membershipId: form(fd, "membershipId"),
  });
  if (!parsed.success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", parsed.data.membershipId)
    .eq("org_id", parsed.data.orgId)
    .select("user_id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: NO_ROW };
  // Leaving yourself: there is nothing left to show in this organization.
  if (data[0]!.user_id === user.id) redirect("/");
  refresh(parsed.data.orgId);
  return { ok: true, message: "Removed from the organization." };
}

export async function updateAssignments(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z
    .object({ orgId: uuid, membershipId: uuid, farmIds: z.array(uuid) })
    .safeParse({ orgId: form(fd, "orgId"), membershipId: form(fd, "membershipId"), farmIds: fd.getAll("farmIds").map(String) });
  if (!parsed.success) return { error: "Invalid request." };
  const { orgId, membershipId, farmIds } = parsed.data;
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("farm_assignments")
    .select("id, farm_id")
    .eq("org_id", orgId)
    .eq("membership_id", membershipId);
  if (readError) return { error: friendlyError(readError) };

  const wanted = new Set(farmIds);
  const toRemove = (current ?? []).filter((a) => !wanted.has(a.farm_id)).map((a) => a.id);
  const have = new Set((current ?? []).map((a) => a.farm_id));
  const toAdd = farmIds.filter((id) => !have.has(id));

  if (toRemove.length) {
    const { error } = await supabase.from("farm_assignments").delete().in("id", toRemove);
    if (error) return { error: friendlyError(error) };
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from("farm_assignments")
      .insert(toAdd.map((farm_id) => ({ org_id: orgId, membership_id: membershipId, farm_id })));
    if (error) return { error: friendlyError(error) };
  }
  refresh(orgId);
  return { ok: true, message: "Farm access updated." };
}

// ---------------------------------------------------------------- Settings

export async function updateOrganization(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const values = {
    name: form(fd, "name"),
    countryCode: form(fd, "countryCode"),
    currencyCode: form(fd, "currencyCode"),
    timezone: form(fd, "timezone"),
  };
  const parsed = orgSettingsSchema.safeParse({ orgId: form(fd, "orgId"), ...values });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      country_code: parsed.data.countryCode,
      currency_code: parsed.data.currencyCode,
      timezone: parsed.data.timezone,
    })
    .eq("id", parsed.data.orgId)
    .select("id");
  if (error) return { error: friendlyError(error), values };
  if (!data?.length) return { error: NO_ROW, values };
  refresh(parsed.data.orgId);
  return { ok: true, message: "Organization settings saved." };
}

export async function updateProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = { fullName: form(fd, "fullName"), phone: form(fd, "phone") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone ?? null })
    .eq("id", user.id)
    .select("id");
  if (error) return { error: friendlyError(error), values };
  if (!data?.length) return { error: NO_ROW, values };
  const orgId = form(fd, "orgId");
  if (uuid.safeParse(orgId).success) refresh(orgId);
  return { ok: true, message: "Your details are saved." };
}
