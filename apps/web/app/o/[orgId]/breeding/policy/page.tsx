import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { getPolicy } from "@/lib/breeding";
import { getOrgContext } from "@/lib/data";
import { RELATIONSHIPS, formatDay, pct } from "@/lib/labels";
import { PolicyForm } from "./policy-form";

export const metadata: Metadata = { title: "Breeding policy" };

const num = (v: number) => String(Number((Number(v) * 100).toFixed(4)));

export default async function PolicyPage({ params }: PageProps<"/o/[orgId]/breeding/policy">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const p = await getPolicy(orgId);
  const today = new Date().toISOString().slice(0, 10);
  const words = (codes: string[]) => codes.map((c) => RELATIONSHIPS.find((r) => r.code === c)?.label ?? c).join(", ");

  return (
    <>
      <Link href={`/o/${orgId}/breeding`} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Breeding
      </Link>
      <PageHeader title="Breeding policy" description="The thresholds every breeding check uses. Each check saves the values it used." />

      {!p ? (
        <p className="text-sm text-muted-foreground">No policy found for goats.</p>
      ) : (
        <>
          {p.advisor_confirmed_on ? (
            <Alert className="mb-4">
              <ShieldCheck className="text-primary" aria-hidden />
              <AlertTitle>Confirmed by {p.advisor_name}</AlertTitle>
              <AlertDescription>On {formatDay(p.advisor_confirmed_on)}.{p.advisor_note ? ` “${p.advisor_note}”` : ""}</AlertDescription>
            </Alert>
          ) : (
            <Alert className="mb-4">
              <ShieldAlert aria-hidden />
              <AlertTitle>Not yet confirmed by a breeding advisor</AlertTitle>
              <AlertDescription>
                These are starting values, not breeding advice. Ask a qualified animal breeding or genetics advisor to review them for your goals and breeds.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardContent>
              {ctx.role === "owner" ? (
                <PolicyForm
                  orgId={orgId}
                  today={today}
                  p={{
                    lowBandMax: num(p.low_band_max),
                    highBandMin: num(p.high_band_min),
                    maxCoi: num(p.max_coi),
                    minCompleteness: String(Math.round(Number(p.min_completeness) * 100)),
                    generations: String(p.generations),
                    blocked: p.blocked_relationships,
                    allowFounderAssumption: p.allow_founder_assumption,
                    advisorName: p.advisor_name ?? "",
                    advisorNote: p.advisor_note ?? "",
                    advisorConfirmedOn: p.advisor_confirmed_on ?? "",
                  }}
                />
              ) : (
                <dl className="grid grid-cols-[11rem_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Low known risk</dt>
                  <dd>Kid COI below {pct(p.low_band_max)}, with completeness at least {pct(p.min_completeness, 0)}</dd>
                  <dt className="text-muted-foreground">High risk</dt>
                  <dd>From {pct(p.high_band_min)}</dd>
                  <dt className="text-muted-foreground">Restricted</dt>
                  <dd>From {pct(p.max_coi)}, or any of: {words(p.blocked_relationships).toLowerCase() || "none"}</dd>
                  <dt className="text-muted-foreground">Completeness</dt>
                  <dd>Over {p.generations} generations{p.allow_founder_assumption ? ", counting founders as complete" : ""}</dd>
                </dl>
              )}
            </CardContent>
          </Card>
          <p className="mt-4 text-sm text-muted-foreground">
            Restricted pairings can only be recorded by an owner or the farm&apos;s manager, with a written reason. High risk and
            not-enough-pedigree results need the person recording to confirm they read the warning.
          </p>
        </>
      )}
    </>
  );
}
