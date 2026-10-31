import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getBreedingAnimals, getMating } from "@/lib/breeding";
import { getOrgContext, isUuid } from "@/lib/data";
import { canRecordBreeding, getBreeds } from "@/lib/herd";
import { animalLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { KiddingForm } from "./kidding-form";

export const metadata: Metadata = { title: "Record a kidding" };

export default async function KiddingPage({ params, searchParams }: PageProps<"/o/[orgId]/breeding/kidding">) {
  const { orgId } = await params;
  const sp = await searchParams;
  const ctx = await getOrgContext(orgId);
  const matingId = typeof sp.mating === "string" && isUuid(sp.mating) ? sp.mating : undefined;
  const [{ bucks, does }, breeds, mating] = await Promise.all([
    getBreedingAnimals(orgId),
    getBreeds(orgId),
    matingId ? getMating(orgId, matingId) : Promise.resolve(null),
  ]);
  const mine = does.filter((d) => canRecordBreeding(ctx, d.farm_id));
  const today = new Date().toISOString().slice(0, 10);
  const base = `/o/${orgId}/breeding`;

  // Default breed: the parents' breed when both match.
  let defaultBreedId: string | undefined;
  if (mating && mating.mating.sires.length === 1) {
    const supabase = await createClient();
    const { data } = await supabase.from("animals").select("id, breed_id").in("id", [mating.mating.dam_id, mating.mating.sires[0]!.sireId]);
    const [a, b] = data ?? [];
    if (a?.breed_id && a.breed_id === b?.breed_id) defaultBreedId = a.breed_id;
  }

  const unavailable = mating && (mating.birth || mating.mating.outcome === "kidded" || !canRecordBreeding(ctx, mating.mating.farm_id));
  const nextDay = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  return (
    <>
      <Link href={mating ? `${base}/matings/${mating.mating.id}` : base} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> {mating ? "Mating" : "Breeding"}
      </Link>
      <PageHeader
        title="Record a kidding"
        description="Live kids are registered on the doe's farm and pen, with their dam and sire already linked."
      />
      <Card>
        <CardContent>
          {unavailable ? (
            <p className="text-sm text-muted-foreground">
              {mating?.birth ? "This mating already has a kidding recorded." : "You can't record a kidding for this mating."}
            </p>
          ) : !mating && mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">There are no does on the farms where you can record breeding.</p>
          ) : (
            <>
              {!mating && (
                <p className="mb-4 text-sm text-muted-foreground">
                  Recorded the mating? Open it from{" "}
                  <Link href={`${base}`} className="text-primary underline-offset-4 hover:underline">
                    Breeding
                  </Link>{" "}
                  so the sire is filled in for you.
                </p>
              )}
              <KiddingForm
                orgId={orgId}
                matingId={mating?.mating.id}
                fixedDoe={mating ? { id: mating.mating.dam_id, label: mating.mating.dam ? animalLabel(mating.mating.dam) : "Doe" } : undefined}
                does={mine.map((d) => ({ id: d.id, label: d.label }))}
                matingSires={mating ? mating.mating.sires.map((s) => ({ id: s.sireId, label: s.label ?? "A buck you can't see" })) : []}
                bucks={bucks.map((b) => ({ id: b.id, label: b.label + (b.origin === "pedigree_only" ? " (records only)" : "") }))}
                breeds={breeds.map((b) => ({ id: b.id, label: b.name }))}
                defaultBreedId={defaultBreedId}
                minDate={mating ? nextDay(mating.mating.started_on) : undefined}
                today={today}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
