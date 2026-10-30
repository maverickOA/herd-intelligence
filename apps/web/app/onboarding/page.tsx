import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { requireUser } from "@/lib/auth";
import { getMyOrganizations } from "@/lib/data";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your farm" };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const orgs = await getMyOrganizations();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:py-16">
      <Brand className="mb-8 self-center text-lg" />
      <OnboardingForm hasOrgs={orgs.length > 0} />
      <div className="mt-6 grid gap-2 text-center text-sm text-muted-foreground">
        {orgs.length > 0 ? (
          <Link href={`/o/${orgs[0]!.id}`} className="underline-offset-4 hover:underline">
            Back to {orgs[0]!.name}
          </Link>
        ) : (
          <p>Joining someone else&apos;s farm? Open the invitation link they sent you instead.</p>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className="underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
