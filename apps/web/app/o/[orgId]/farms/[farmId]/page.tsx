import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManageFarm, getFarmWithPens, getOrgContext } from "@/lib/data";
import { AddPenForm, FarmDetailsForm, PenRow } from "../forms";

export const metadata: Metadata = { title: "Farm" };

export default async function FarmPage({ params }: PageProps<"/o/[orgId]/farms/[farmId]">) {
  const { orgId, farmId } = await params;
  const ctx = await getOrgContext(orgId);
  const { farm, pens } = await getFarmWithPens(orgId, farmId);
  const manage = canManageFarm(ctx, farm.id);
  const capacity = pens.reduce((n, p) => n + (p.capacity ?? 0), 0);

  return (
    <>
      <Link
        href={`/o/${orgId}/farms`}
        className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> All farms
      </Link>
      <PageHeader
        title={farm.name}
        description={
          pens.length
            ? `${pens.length} pen${pens.length === 1 ? "" : "s"}${capacity ? ` · room for about ${capacity} head` : ""}`
            : "No pens yet"
        }
      />

      <section aria-labelledby="pens-heading">
        <h2 id="pens-heading" className="mb-3 text-lg font-semibold">
          Pens
        </h2>
        {pens.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {manage
                ? "No pens yet. Add the pens, paddocks and kidding areas on this farm below."
                : "No pens have been added to this farm yet."}
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-2">
            {pens.map((p) => (
              <PenRow key={p.id} orgId={orgId} farmId={farm.id} pen={p} canManage={manage} />
            ))}
          </ul>
        )}

        {manage && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Add a pen</CardTitle>
            </CardHeader>
            <CardContent>
              <AddPenForm orgId={orgId} farmId={farm.id} />
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="details-heading" className="mt-8">
        <h2 id="details-heading" className="mb-3 text-lg font-semibold">
          Farm details
        </h2>
        <Card>
          {manage ? (
            <CardContent className="pt-6">
              <FarmDetailsForm orgId={orgId} farm={farm} />
            </CardContent>
          ) : (
            <CardHeader>
              <CardTitle className="text-base">{farm.name}</CardTitle>
              <CardDescription>{farm.address ?? "No address recorded."}</CardDescription>
            </CardHeader>
          )}
        </Card>
      </section>
    </>
  );
}
