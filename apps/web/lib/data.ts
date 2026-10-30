import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Enums, Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/*
 * Data Access Layer. Every read goes through the user's own Supabase session,
 * so Row Level Security filters rows. The role checks here only decide what to
 * show; the database enforces what is allowed.
 */

export type Role = Enums<"member_role">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}

export type MyOrganization = { id: string; name: string; role: Role };

export const getMyOrganizations = cache(async (): Promise<MyOrganization[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organizations(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw error;
  return (data ?? [])
    .flatMap((m) => (m.organizations ? [{ id: m.organizations.id, name: m.organizations.name, role: m.role }] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
});

export type OrgContext = {
  org: Tables<"organizations">;
  role: Role;
  membershipId: string;
  assignedFarmIds: string[];
  user: { id: string; email: string | null };
};

/** The organization plus the signed-in user's role in it. 404 if not a member. */
export const getOrgContext = cache(async (orgId: string): Promise<OrgContext> => {
  if (!isUuid(orgId)) notFound();
  const user = await requireUser(`/o/${orgId}`);
  const supabase = await createClient();

  const [{ data: membership }, { data: org }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, role, status")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
  ]);
  if (!membership || !org) notFound();

  const { data: assignments } = await supabase
    .from("farm_assignments")
    .select("farm_id")
    .eq("membership_id", membership.id);

  return {
    org,
    role: membership.role,
    membershipId: membership.id,
    assignedFarmIds: (assignments ?? []).map((a) => a.farm_id),
    user,
  };
});

export function isOwner(ctx: OrgContext) {
  return ctx.role === "owner";
}

/** Mirrors app.can_manage_farm(): owners, and managers assigned to the farm. */
export function canManageFarm(ctx: OrgContext, farmId: string) {
  return ctx.role === "owner" || (ctx.role === "manager" && ctx.assignedFarmIds.includes(farmId));
}

export async function getFarms(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farms")
    .select("id, name, address, timezone, created_at, pens(count)")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .is("pens.deleted_at", null)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((f) => ({
    ...f,
    penCount: (f.pens as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export async function getFarmWithPens(orgId: string, farmId: string) {
  if (!isUuid(farmId)) notFound();
  const supabase = await createClient();
  const [{ data: farm }, { data: pens, error }] = await Promise.all([
    supabase.from("farms").select("*").eq("org_id", orgId).eq("id", farmId).is("deleted_at", null).maybeSingle(),
    supabase
      .from("pens")
      .select("id, name, pen_type, capacity, deleted_at, version")
      .eq("org_id", orgId)
      .eq("farm_id", farmId)
      .is("deleted_at", null)
      .order("name"),
  ]);
  if (!farm) notFound();
  if (error) throw error;
  return { farm, pens: pens ?? [] };
}

export type TeamMember = {
  membershipId: string;
  userId: string;
  role: Role;
  status: Enums<"member_status">;
  joinedAt: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  farmIds: string[];
};

export async function getTeam(orgId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const [{ data: members, error }, { data: assignments }] = await Promise.all([
    supabase.from("memberships").select("id, user_id, role, status, created_at").eq("org_id", orgId),
    supabase.from("farm_assignments").select("membership_id, farm_id").eq("org_id", orgId),
  ]);
  if (error) throw error;
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", userIds)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const roleOrder: Record<Role, number> = { owner: 0, manager: 1, vet: 2, worker: 3 };

  return (members ?? [])
    .map((m) => {
      const p = byId.get(m.user_id);
      return {
        membershipId: m.id,
        userId: m.user_id,
        role: m.role,
        status: m.status,
        joinedAt: m.created_at,
        fullName: p?.full_name ?? null,
        email: p?.email ?? null,
        phone: p?.phone ?? null,
        farmIds: (assignments ?? []).filter((a) => a.membership_id === m.id).map((a) => a.farm_id),
      };
    })
    .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""));
}

export async function getOpenInvitations(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, role, farm_ids, expires_at, created_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMyProfile() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, phone, email").eq("id", user.id).maybeSingle();
  return { ...user, fullName: data?.full_name ?? null, phone: data?.phone ?? null };
}
