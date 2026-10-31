import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getBreedingAnimals } from "@/lib/breeding";
import { getOrgContext, isUuid } from "@/lib/data";
import { PairingForm } from "./pairing-form";

export const metadata: Metadata = { title: "Check a pairing" };

export default async function CheckPage({ params, searchParams }: PageProps<"/o/[orgId]/breeding/check">) {
  const { orgId } = await params;
  const sp = await searchParams;
  await getOrgContext(orgId);
  const { bucks, does } = await getBreedingAnimals(orgId);
  const pick = (k: string) => (typeof sp[k] === "string" && isUuid(sp[k] as string) ? (sp[k] as string) : undefined);
  const label = (a: { label: string; origin: string }) => a.label + (a.origin === "pedigree_only" ? " (records only, AI)" : "");

  return (
    <>
      <Link href={`/o/${orgId}/breeding`} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Breeding
      </Link>
      <PageHeader
        title="Check a pairing"
        description="Works out the expected inbreeding (COI) of their kids from every recorded ancestor, including those on farms you can't see."
      />
      <Card>
        <CardContent>
          {bucks.length === 0 || does.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You need at least one buck and one doe in the herd.{" "}
              <Link href={`/o/${orgId}/herd/new`} className="font-medium text-primary underline-offset-4 hover:underline">
                Register an animal
              </Link>
            </p>
          ) : (
            <PairingForm
              orgId={orgId}
              bucks={bucks.map((b) => ({ id: b.id, label: label(b) }))}
              does={does.map((d) => ({ id: d.id, label: d.label }))}
              buckId={pick("buck")}
              doeId={pick("doe")}
            />
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-sm text-muted-foreground">
        Every check is saved with the policy and pedigree it used, so you can see later exactly why a pairing was rated as it was.
      </p>
    </>
  );
}
