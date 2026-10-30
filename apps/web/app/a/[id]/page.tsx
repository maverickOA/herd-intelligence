import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/*
 * Landing page for a scanned QR tag. The tag carries only the animal's id; the
 * signed-in user's access decides whether it opens (unknown and forbidden look
 * the same, so a tag reveals nothing).
 */
export default async function ScanPage({ params }: PageProps<"/a/[id]">) {
  const { id } = await params;
  await requireUser(`/a/${id}`);
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("animals").select("id, org_id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  redirect(`/o/${data.org_id}/herd/${data.id}`);
}
