"use server";

import { redirect } from "next/navigation";
import { friendlyError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  await requireUser(`/invite/${encodeURIComponent(token)}`);
  if (!/^[0-9a-f]{48}$/.test(token)) return { error: "This invitation link is incomplete. Ask the farm owner to send it again." };

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !orgId) return { error: friendlyError(error, "Could not accept the invitation. Please try again.") };
  redirect(`/o/${orgId}`);
}
