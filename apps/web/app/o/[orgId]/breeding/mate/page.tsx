import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getBreedingAnimals } from "@/lib/breeding";
import { getOrgContext, isUuid } from "@/lib/data";
import { canApproveRestricted, canRecordBreeding } from "@/lib/herd";
import { MatingForm } from "./mating-form";

export const metadata: Metadata = { title: "Record a mating" };

export default async function MatePage({ params, searchParams }: PageProps<"/o/[orgId]/breeding/mate">) {
  const { orgId } = await params;
  const sp = await searchParams;
  const ctx = await getOrgContext(orgId);
  const { bucks, does } = await getBreedingAnimals(orgId);
  const mine = does.filter((d) => canRecordBreeding(ctx, d.farm_id));
  const pick = (k: string) => (typeof sp[k] === "string" && isUuid(sp[k] as string) ? (sp[k] as string) : undefined);
  const labels = Object.fromEntries([...bucks, ...does].map((a) => [a.id, a.label]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link href={`/o/${orgId}/breeding`} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Breeding
      </Link>
      <PageHeader title="Record a mating" description="Each buck is checked against the doe first. The check is saved with the mating." />
      <Card>
        <CardContent>
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">There are no does on the farms where you can record breeding.</p>
          ) : bucks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There are no bucks to choose.{" "}
              <Link href={`/o/${orgId}/herd/new`} className="font-medium text-primary underline-offset-4 hover:underline">
                Register a buck
              </Link>
            </p>
          ) : (
            <MatingForm
              orgId={orgId}
              does={mine.map((d) => ({ id: d.id, label: d.label, canApprove: canApproveRestricted(ctx, d.farm_id) }))}
              bucks={bucks.map((b) => ({ id: b.id, label: b.label, recordsOnly: b.origin === "pedigree_only" }))}
              labels={labels}
              initialDoe={mine.some((d) => d.id === pick("doe")) ? pick("doe") : undefined}
              initialBuck={pick("buck")}
              today={today}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
