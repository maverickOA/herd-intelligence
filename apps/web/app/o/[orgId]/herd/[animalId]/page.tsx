import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, Pencil, QrCode } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrgContext } from "@/lib/data";
import { canEditAnimal, getAnimalDetail, getParentOptions, getPedigree } from "@/lib/herd";
import { GONE_STATUSES, ORIGIN_LABEL, SEX_LABEL, STATUS_LABEL, ageText, animalLabel, formatDate } from "@/lib/labels";
import { AcquisitionForm } from "./acquisition-form";
import { ParentRow, type ParentView } from "./parents";
import { PedigreeTree, ancestorCount } from "./pedigree-tree";

export const metadata: Metadata = { title: "Animal" };

const SAVED: Record<string, string> = {
  registered: "Animal registered.",
  updated: "Changes saved.",
  ancestor: "Ancestor added and linked.",
};

export default async function AnimalPage({ params, searchParams }: PageProps<"/o/[orgId]/herd/[animalId]">) {
  const { orgId, animalId } = await params;
  const sp = await searchParams;
  const ctx = await getOrgContext(orgId);
  const canEditAll = ctx.role === "owner" || ctx.role === "manager";
  const detail = await getAnimalDetail(orgId, animalId, canEditAll);
  const { animal } = detail;
  const canEdit = canEditAnimal(ctx, animal.farm_id);
  const [tree, parentOptions] = await Promise.all([getPedigree(animal.id, 3), canEdit ? getParentOptions(orgId) : Promise.resolve([])]);
  const tz = ctx.org.timezone;
  const recordOnly = animal.origin === "pedigree_only";
  const age = ageText(animal.birth_date, animal.birth_date_estimated);
  const known = ancestorCount(tree);
  const base = `/o/${orgId}/herd`;

  const parentView = (role: "sire" | "dam"): ParentView => {
    const p = role === "sire" ? detail.sire : detail.dam;
    return {
      role,
      parentId: p?.parentId ?? null,
      label: p?.parent ? animalLabel(p.parent) : null,
      hidden: !!p && !p.parent,
      confidence: p?.confidence ?? null,
      evidence: p?.evidence ?? null,
    };
  };

  const saved = typeof sp.saved === "string" ? SAVED[sp.saved] : undefined;
  const warning = typeof sp.warning === "string" ? sp.warning.slice(0, 400) : undefined;

  const facts: [string, React.ReactNode][] = [
    ["Sex", SEX_LABEL[animal.sex]],
    ["Breed", detail.breed?.name ?? "Not recorded"],
    [
      "Born",
      animal.birth_date
        ? `${animal.birth_date_estimated ? "About " : ""}${formatDate(`${animal.birth_date}T12:00:00Z`, tz)}${age ? ` (${age})` : ""}`
        : "Not recorded",
    ],
    ["Origin", ORIGIN_LABEL[animal.origin]],
  ];
  if (!recordOnly) facts.push(["Location", [detail.farm?.name, detail.pen?.name].filter(Boolean).join(", ") || "—"]);
  if (animal.registration_number) facts.push(["Registration", animal.registration_number]);
  if (animal.color) facts.push(["Colour", animal.color]);
  if (animal.markings) facts.push(["Markings", animal.markings]);

  return (
    <>
      <Link href={recordOnly ? `${base}?view=records` : base} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Herd
      </Link>

      {saved && (
        <Alert className="mb-4" role="status">
          <CheckCircle2 className="text-primary" aria-hidden />
          <AlertDescription>{saved}</AlertDescription>
        </Alert>
      )}
      {warning && (
        <Alert className="mb-4" variant="destructive" role="alert">
          <AlertTriangle aria-hidden />
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{animalLabel(animal)}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{SEX_LABEL[animal.sex]}</Badge>
            {!recordOnly && <Badge variant={GONE_STATUSES.includes(animal.status) ? "outline" : "secondary"}>{STATUS_LABEL[animal.status]}</Badge>}
            {recordOnly && <Badge variant="outline">Records only</Badge>}
            {animal.is_declared_founder && <Badge variant="outline">Founder</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          {!recordOnly && (
            <Button asChild variant="outline" className="h-11">
              <Link href={`${base}/${animal.id}/tag`}>
                <QrCode aria-hidden /> QR tag
              </Link>
            </Button>
          )}
          {canEdit && (
            <Button asChild className="h-11">
              <Link href={`${base}/${animal.id}/edit`}>
                <Pencil aria-hidden /> Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr_8rem_1fr]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          {animal.is_declared_founder && (
            <p className="mt-4 rounded-md bg-muted p-3 text-sm">
              Treated as a founder: its unknown ancestors are assumed unrelated to the rest of the herd.
              {animal.founder_note ? ` ${animal.founder_note}` : ""}
            </p>
          )}
          {animal.notes && <p className="mt-4 text-sm whitespace-pre-line">{animal.notes}</p>}
        </CardContent>
      </Card>

      <section aria-labelledby="parents-heading" className="mt-8">
        <h2 id="parents-heading" className="mb-3 text-lg font-semibold">
          Parents
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["sire", "dam"] as const).map((role) => (
            <ParentRow key={role} orgId={orgId} childId={animal.id} current={parentView(role)} options={parentOptions} canEdit={canEdit} />
          ))}
        </div>
        {!canEdit && <p className="mt-2 text-sm text-muted-foreground">Owners and this farm&apos;s managers can record parents.</p>}
      </section>

      <section aria-labelledby="pedigree-heading" className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pedigree-heading" className="text-lg font-semibold">
            Family tree
          </h2>
          <p className="text-sm text-muted-foreground">
            {known} of 14 ancestors recorded over three generations
          </p>
        </div>
        <PedigreeTree orgId={orgId} nodes={tree} />
        {known < 14 && !animal.is_declared_founder && (
          <p className="mt-2 text-sm text-muted-foreground">
            Breeding checks are only as good as this tree. Ask sellers for sire, dam and grandparents when you buy.
          </p>
        )}
      </section>

      {detail.offspring.length > 0 && (
        <section aria-labelledby="offspring-heading" className="mt-8">
          <h2 id="offspring-heading" className="mb-3 text-lg font-semibold">
            Offspring <Badge variant="secondary">{detail.offspring.length}</Badge>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {detail.offspring.map((o) => (
              <li key={o.id} className="min-w-0">
                <Link href={`${base}/${o.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent">
                  <span className="min-w-0 flex-1 truncate font-medium">{animalLabel(o)}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {[SEX_LABEL[o.sex], ageText(o.birth_date, o.birth_date_estimated)].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (animal.origin === "purchased" || animal.origin === "received") && (
        <section aria-labelledby="purchase-heading" className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle id="purchase-heading" className="text-base">
                Purchase details
              </CardTitle>
              <CardDescription>Only owners and farm managers can see these.</CardDescription>
            </CardHeader>
            <CardContent>
              <AcquisitionForm orgId={orgId} animalId={animal.id} currency={ctx.org.currency_code} acquisition={detail.acquisition} />
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-labelledby="timeline-heading" className="mt-8">
        <h2 id="timeline-heading" className="mb-3 text-lg font-semibold">
          Timeline
        </h2>
        {detail.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ol className="grid gap-0 border-l pl-4">
            {detail.events.map((e) => (
              <li key={e.id} className="relative pb-4 last:pb-0">
                <span aria-hidden className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full border-2 border-background bg-primary" />
                <p className="text-sm">{e.summary}</p>
                <p className="text-xs text-muted-foreground">{formatDate(e.occurred_at, tz)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
