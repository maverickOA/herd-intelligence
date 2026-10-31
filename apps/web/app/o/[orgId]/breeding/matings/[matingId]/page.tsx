import type { Metadata } from "next";
import Link from "next/link";
import { Baby, CheckCircle2, ChevronLeft } from "lucide-react";
import { ClassBadge } from "@/components/breeding/class-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMating } from "@/lib/breeding";
import { getOrgContext } from "@/lib/data";
import { canRecordBreeding } from "@/lib/herd";
import { METHOD_LABEL, OUTCOME_LABEL, PREG_METHOD_LABEL, PREG_RESULT_LABEL, animalLabel, formatDay } from "@/lib/labels";
import { PregnancyForm } from "./pregnancy-form";

export const metadata: Metadata = { title: "Mating" };

export default async function MatingPage({ params, searchParams }: PageProps<"/o/[orgId]/breeding/matings/[matingId]">) {
  const { orgId, matingId } = await params;
  const sp = await searchParams;
  const ctx = await getOrgContext(orgId);
  const { mating: m, checks, birth } = await getMating(orgId, matingId);
  const canRecord = canRecordBreeding(ctx, m.farm_id);
  const base = `/o/${orgId}/breeding`;
  const today = new Date().toISOString().slice(0, 10);
  const open = m.outcome === "awaiting_check" || m.outcome === "pregnant";
  const doeName = m.dam ? animalLabel(m.dam) : "Doe";

  return (
    <>
      <Link href={`${base}/matings`} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Matings
      </Link>
      {sp.saved === "mating" && (
        <Alert className="mb-4" role="status">
          <CheckCircle2 className="text-primary" aria-hidden />
          <AlertDescription>Mating recorded with its breeding check.</AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Mating · {METHOD_LABEL[m.method]}</p>
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            <Link href={`/o/${orgId}/herd/${m.dam_id}`} className="underline-offset-4 hover:underline">
              {doeName}
            </Link>
          </h1>
          <Badge className="mt-2" variant={m.outcome === "pregnant" ? "default" : "secondary"}>
            {OUTCOME_LABEL[m.outcome]}
          </Badge>
        </div>
        {canRecord && open && !birth && (
          <Button asChild className="h-11">
            <Link href={`${base}/kidding?mating=${m.id}`}>
              <Baby aria-hidden /> Record kidding
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{m.method === "pasture" ? "Bucks in" : "Date"}</dt>
            <dd>
              {formatDay(m.started_on)}
              {m.ended_on ? ` to ${formatDay(m.ended_on)}` : ""}
            </dd>
            <dt className="text-muted-foreground">Due (estimate)</dt>
            <dd>
              {m.scanDue
                ? `${formatDay(m.scanDue)}, from the scan`
                : `${formatDay(m.dueFrom)}${m.dueTo !== m.dueFrom ? ` to ${formatDay(m.dueTo)}` : ""}, about 150 days after mating`}
            </dd>
            {m.notes && (
              <>
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-line">{m.notes}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">{m.sires.length > 1 ? "Bucks (father uncertain)" : "Buck"}</h2>
        <ul className="grid gap-2">
          {m.sires.map((s) => (
            <li key={s.sireId} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
              {s.label ? (
                <Link href={`/o/${orgId}/herd/${s.sireId}`} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
                  {s.label}
                </Link>
              ) : (
                <span className="flex-1 text-muted-foreground">A buck on a farm you can&apos;t see</span>
              )}
              {s.classification && <ClassBadge value={s.classification} />}
              {s.overridden && <Badge variant="outline">Approved with a reason</Badge>}
              <Link href={`${base}/assessments/${s.assessmentId}`} className="text-primary underline-offset-4 hover:underline">
                Check
              </Link>
            </li>
          ))}
        </ul>
        {m.risk_acknowledged && <p className="mt-2 text-sm text-muted-foreground">The breeding check warning was acknowledged when this was recorded.</p>}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Pregnancy checks</h2>
        {checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. A scan is usually reliable from about 30 days after mating.</p>
        ) : (
          <ul className="grid gap-2">
            {checks.map((c) => (
              <li key={c.id} className="rounded-xl border bg-card p-3 text-sm">
                <p className="font-medium">
                  {PREG_RESULT_LABEL[c.result]} · {formatDay(c.checked_on)}
                </p>
                <p className="text-muted-foreground">
                  {PREG_METHOD_LABEL[c.method]}
                  {c.due_on ? ` · due about ${formatDay(c.due_on)}` : ""}
                </p>
                {c.notes && <p className="mt-1 whitespace-pre-line">{c.notes}</p>}
              </li>
            ))}
          </ul>
        )}
        {canRecord && open && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Record a pregnancy check</CardTitle>
            </CardHeader>
            <CardContent>
              <PregnancyForm orgId={orgId} doeId={m.dam_id} matingId={m.id} minDate={m.started_on} today={today} />
            </CardContent>
          </Card>
        )}
      </section>

      {birth && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Kidding</h2>
          <Link href={`${base}/kiddings/${birth.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent">
            <Baby className="size-5 text-muted-foreground" aria-hidden />
            <span className="font-medium">Kidded {formatDay(birth.born_on)}</span>
          </Link>
        </section>
      )}
    </>
  );
}
