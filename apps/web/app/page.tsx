import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMyOrganizations } from "@/lib/data";

/** Send people where they belong: sign in, set up an organization, or their farm. */
export default async function Home() {
  await requireUser();
  const orgs = await getMyOrganizations();
  if (orgs.length === 0) redirect("/onboarding");
  redirect(`/o/${orgs[0]!.id}`);
}
