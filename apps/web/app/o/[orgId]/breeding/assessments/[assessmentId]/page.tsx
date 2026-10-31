import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ClipboardCheck, RefreshCw } from "lucide-react";
import { ClassBadge } from "@/components/breeding/class-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAssessment, labelize } from "@/lib/breeding";
import { sentence } from "@/lib/labelize";
import { getOrgContext } from "@/lib/data";
import { canRecordBreeding } from "@/lib/herd";
import { createClient } from "@/lib/supabase/server";
import { CLASS_LABEL, CONFIDENCE_LABEL, ROLE_LABEL, formatDate, pct } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Breeding check" };

const RELATIONSHIP_WORDS: Record<string, string> = {
  "parent-offspring": "Parent and offspring",
  "full-siblings": "Full siblings",
  "half-siblings": "Half siblings",
  "grandparent-grandchild": "Grandparent and grandchild",
  "first-cousins": "First cousins",
};

export default async function AssessmentPage({ params }: PageProps<"/o/[orgId]/breeding/assessments/[assessmentId]">) {
  const { orgId, assessmentId } = await params;
  const ctx = await getOrgContext(orgId);
  const { assessment: row, result: a, labels, override, requestedBy } = await getAssessment(orgId, assessmentId);
  const L = (text: string) => sentence(labelize(text, labels));
  const name = (id: string) => labels.get(id) ?? "an animal on a farm you can't see";
  const supabase = await createClient();
  const { data: doe } = await supabase.from("animals").select("farm_id").eq("id", row.doe_id).maybeSingle();
  const canMate = canRecordBreeding(ctx, doe?.farm_id ?? null);
  const base = `/o/${orgId}/breeding`;
  const policy = a.policy;
  const comp = a.completeness;
  const worstHigher = a.worstCaseCoi && a.worstCaseCoi.value > a.knownCoi.value;

  const figures: [string, React.ReactNode, string?][] = [
    ["Expected kid COI", `${a.knownCoi.display} (${a.knownCoi.exact})`, "From recorded ancestors. Missing ancestors can only raise it."],
    ...(worstHigher ? [["Worst case (uncertain sire)", a.worstCaseCoi!.display, "If an unconfirmed sire turns out to be the father."] as [string, string, string]] : []),
    ["Using only DNA or seen links", a.verifiedOnlyCoi.display, "Ignores parents that were reported or assumed."],
    [
      `Pedigree completeness (${comp.generations} generations)`,
      `${pct(comp.used, 0)}${comp.usesFounderAssumption ? ` (recorded ${pct(comp.recorded.pci, 0)})` : ""}`,
      `The policy asks for at least ${pct(policy.minCompleteness, 0)}.`,
    ],
    ["Relationship coefficient", a.coefficientOfRelationship.display],
  ];

  return (
    <>
      <Link href={base} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Breeding
      </Link>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground">Breeding check</p>
        <h1 className="text-2xl font-semibold tracking-tight break-words">
          <AnimalLink orgId={orgId} id={row.buck_id} label={labels.get(row.buck_id)} /> ×{" "}
          <AnimalLink orgId={orgId} id={row.doe_id} label={labels.get(row.doe_id)} />
        </h1>
      </div>

      <Card className={cn(row.classification === "restricted" && "border-destructive/50")}>
        <CardContent className="grid gap-3">
          <ClassBadge value={row.classification} possible={row.possible} long className="w-fit text-sm" />
          <ul className="grid gap-1.5 text-sm">
            {a.explanation.map((line, i) => (
              <li key={i}>{L(line)}</li>
            ))}
          </ul>
          {row.classification === "low" && (
            <p className="text-sm text-muted-foreground">
              &ldquo;Low&rdquo; means low on the recorded pedigree. It is not a guarantee: unrecorded relatives can only add risk.
            </p>
          )}
          {override && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">Approved anyway by a {ROLE_LABEL[override.approver_role].toLowerCase()}</p>
              <p className="mt-1">&ldquo;{override.reason}&rdquo;</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(override.created_at, ctx.org.timezone)}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {canMate && (
              <Button asChild className="h-11">
                <Link href={`${base}/mate?doe=${row.doe_id}&buck=${row.buck_id}`}>
                  <ClipboardCheck aria-hidden /> Record this mating
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="h-11">
              <Link href={`${base}/check?doe=${row.doe_id}&buck=${row.buck_id}`}>
                <RefreshCw aria-hidden /> Check again
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">The figures</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          {figures.map(([k, v, hint]) => (
            <div key={k} className="rounded-xl border bg-card p-3">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="text-lg font-semibold tabular-nums">{v}</dd>
              {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
            </div>
          ))}
        </dl>
      </section>

      {a.relationships.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">How they are related</h2>
          <ul className="grid gap-2 text-sm">
            {a.relationships.map((r, i) => (
              <li key={i} className="rounded-xl border bg-card p-3">
                <span className="font-medium">{RELATIONSHIP_WORDS[r.code] ?? L(r.label).split(" (")[0]}</span>
                {policy.blockedRelationships.includes(r.code) && <span className="text-destructive"> · blocked by your policy</span>}
                <p className="text-muted-foreground">{L(r.label)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {a.commonAncestors.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 text-lg font-semibold">Shared ancestors</h2>
          <p className="mb-3 text-sm text-muted-foreground">Each line of descent through a shared ancestor adds to the kid&apos;s COI (Wright&apos;s paths).</p>
          <ul className="grid gap-2">
            {a.commonAncestors.map((c) => (
              <li key={c.ancestorId} className="rounded-xl border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{name(c.ancestorId)}</span>
                  <span className="tabular-nums">adds {c.contribution.display}</span>
                </div>
                <ul className="mt-2 grid gap-1 text-muted-foreground">
                  {c.paths.slice(0, 6).map((p, i) => (
                    <li key={i} className="break-words">
                      {[p.buckSide.map(name).join(" → "), ...p.doeSide.slice(0, -1).reverse().map(name)].join(" ← ")} <span className="whitespace-nowrap">({p.contribution.display}{p.weakestConfidence && p.weakestConfidence !== "dna" && p.weakestConfidence !== "observed" ? `, weakest link ${CONFIDENCE_LABEL[p.weakestConfidence].toLowerCase()}` : ""})</span>
                    </li>
                  ))}
                  {c.paths.length > 6 && <li>and {c.paths.length - 6} more paths</li>}
                </ul>
              </li>
            ))}
          </ul>
          {a.explanationTruncated && <p className="mt-2 text-sm text-muted-foreground">Some paths are not listed; the COI itself is exact.</p>}
        </section>
      )}

      {a.limitations.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">What this check can&apos;t see</h2>
          <ul className="grid list-disc gap-1.5 pl-5 text-sm">
            {a.limitations.map((l, i) => (
              <li key={i}>{L(l)}</li>
            ))}
          </ul>
        </section>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Record of this check</CardTitle>
          <CardDescription>Saved exactly as calculated. It is never changed afterwards.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Checked</dt>
            <dd>
              {formatDate(row.created_at, ctx.org.timezone)} by {requestedBy}
            </dd>
            <dt className="text-muted-foreground">Result</dt>
            <dd>{CLASS_LABEL[row.classification]}</dd>
            <dt className="text-muted-foreground">Policy used</dt>
            <dd>
              Low below {pct(policy.lowBandMax)}, high from {pct(policy.highBandMin)}, restricted from {pct(policy.maxCoi)}; blocked:{" "}
              {policy.blockedRelationships.map((r) => RELATIONSHIP_WORDS[r] ?? r).join(", ").toLowerCase() || "none"}
              {policy.advisorName ? `; advisor ${policy.advisorName}` : "; not yet confirmed by an advisor"}
            </dd>
            <dt className="text-muted-foreground">Method</dt>
            <dd>Tabular kinship, cross-checked with Wright&apos;s paths · engine {row.engine_version}</dd>
            <dt className="text-muted-foreground">Pedigree</dt>
            <dd className="break-all">
              revision {row.pedigree_revision} · <span className="font-mono text-xs">{row.pedigree_hash.slice(0, 16)}</span>
            </dd>
          </dl>
        </CardContent>
      </Card>
    </>
  );
}

function AnimalLink({ orgId, id, label }: { orgId: string; id: string; label?: string }) {
  if (!label) return <span>an animal you can&apos;t see</span>;
  return (
    <Link href={`/o/${orgId}/herd/${id}`} className="underline-offset-4 hover:underline">
      {label}
    </Link>
  );
}
