import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ChevronLeft } from "lucide-react";
import { ClassBadge } from "@/components/breeding/class-badge";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BreedingError, getBreedingAnimals, idsIn, labelize, labelsFor, rankBucks, type RankResult } from "@/lib/breeding";
import { getOrgContext, isUuid } from "@/lib/data";
import { pct } from "@/lib/labels";

export const metadata: Metadata = { title: "Best bucks for a doe" };

export default async function RankPage({ params, searchParams }: PageProps<"/o/[orgId]/breeding/rank">) {
  const { orgId } = await params;
  const sp = await searchParams;
  await getOrgContext(orgId);
  const doeId = typeof sp.doe === "string" && isUuid(sp.doe) ? sp.doe : undefined;
  const { does } = await getBreedingAnimals(orgId);
  const base = `/o/${orgId}/breeding`;

  let result: RankResult | null = null;
  let error: string | null = null;
  if (doeId) {
    try {
      result = await rankBucks(doeId);
    } catch (e) {
      error = e instanceof BreedingError ? e.message : "The ranking could not be completed, so no result is shown. Try again.";
    }
  }
  const labels = result ? await labelsFor(idsIn(result)) : new Map<string, string>();

  return (
    <>
      <Link href={base} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Breeding
      </Link>
      <PageHeader
        title="Best bucks for a doe"
        description="Every buck you can see, checked against her pedigree. Documented low-risk pairings come first; missing pedigree never ranks above a documented result."
      />

      <form method="get" className="mb-6 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="doe">Doe</Label>
          <NativeSelect id="doe" name="doe" defaultValue={doeId ?? ""} required>
            <option value="" disabled>
              Choose a doe
            </option>
            {does.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" className="h-11">
          Rank bucks
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <>
          {result.ranked.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">No bucks available to rank.</CardContent>
            </Card>
          ) : (
            <ol className="grid gap-2">
              {result.ranked.map((r) => (
                <li key={r.buckId} className="rounded-xl border bg-card p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums" aria-label={`Rank ${r.rank}`}>
                      {r.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{labels.get(r.buckId) ?? "Buck"}</p>
                      <p className="text-sm text-muted-foreground">
                        COI {r.classifiedCoi.display}
                        {r.worstCaseCoi && r.worstCaseCoi.value > r.knownCoi.value ? ` (worst case; recorded ${r.knownCoi.display})` : ""} · completeness{" "}
                        {pct(r.completeness, 0)}
                        {r.usesFounderAssumption ? " with founder assumption" : ""}
                      </p>
                      {r.relationships.length > 0 && <p className="text-sm text-muted-foreground">{labelize(r.relationships.map((x) => x.label).join("; "), labels)}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <ClassBadge value={r.classification.code} possible={r.classification.possible} />
                        <Link
                          href={`${base}/check?doe=${result.doeId}&buck=${r.buckId}`}
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Full check
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {result.ineligible.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Not ranked</h2>
              <ul className="grid gap-1 text-sm">
                {result.ineligible.map((r) => (
                  <li key={r.buckId}>
                    {labels.get(r.buckId) ?? "Buck"}: {r.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            This list isn&apos;t saved. Open a full check to keep a record, then record the mating from there.
          </p>
        </>
      )}
    </>
  );
}
