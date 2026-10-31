import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMatings } from "@/lib/breeding";
import { getOrgContext } from "@/lib/data";
import { METHOD_SHORT, OUTCOME_LABEL, animalLabel, formatDay } from "@/lib/labels";

export const metadata: Metadata = { title: "Matings" };

export default async function MatingsPage({ params }: PageProps<"/o/[orgId]/breeding/matings">) {
  const { orgId } = await params;
  await getOrgContext(orgId);
  const matings = await getMatings(orgId, { limit: 300 });
  const base = `/o/${orgId}/breeding`;
  return (
    <>
      <Link href={base} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Breeding
      </Link>
      <PageHeader title="Matings" description={matings.length ? `${matings.length} recorded on the farms you can see` : undefined} />
      {matings.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No matings recorded yet.{" "}
            <Link href={`${base}/mate`} className="font-medium text-primary underline-offset-4 hover:underline">
              Record one
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {matings.map((m) => (
            <li key={m.id}>
              <Link href={`${base}/matings/${m.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.dam ? animalLabel(m.dam) : "Doe"} × {m.sires.map((s) => s.label ?? "a buck you can't see").join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {METHOD_SHORT[m.method]} · {formatDay(m.started_on)}
                  </p>
                </div>
                <Badge variant={m.outcome === "pregnant" ? "default" : "secondary"} className="shrink-0">
                  {OUTCOME_LABEL[m.outcome]}
                </Badge>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
