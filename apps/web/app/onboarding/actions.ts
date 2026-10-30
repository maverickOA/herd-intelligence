"use server";

import { redirect } from "next/navigation";
import { friendlyError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, organizationSchema } from "@/lib/validation";

export async function createOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const values = { name: String(formData.get("name") ?? ""), firstFarmName: String(formData.get("firstFarmName") ?? "") };
  const parsed = organizationSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_first_farm_name: parsed.data.firstFarmName,
  });
  if (error || !orgId) return { error: friendlyError(error, "Could not create your organization. Please try again."), values };
  redirect(`/o/${orgId}`);
}
