import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { getBirth } from "@/lib/breeding";
import { getOrgContext } from "@/lib/data";
import { SEX_LABEL, formatDay } from "@/lib/labels";

export const metadata: Metadata = { title: "Kidding" };

export default async function BirthPage({ params, searchParams }: PageProps<"/o/[orgId]/breeding/kiddings/[birthId]">) {
  const { orgId, birthId } = await params;
  const sp = await searchParams;
  await getOrgContext(orgId);
  const { birth, offspring, labels } = await getBirth(orgId, birthId);
  const alive = offspring.filter((o) => o.born_alive);
  const base = `/o/${orgId}`;

  return (
    <>
      <Link href={`${base}/breeding`} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Breeding
      </Link>
      {sp.saved && (
        <Alert className="mb-4" role="status">
          <CheckCircle2 className="text-primary" aria-hidden />
          <AlertDescription>
            Kidding recorded. {alive.length} kid{alive.length === 1 ? "" : "s"} registered with {alive.length === 1 ? "its" : "their"} parents.
          </AlertDescription>
        </Alert>
      )}
      <p className="text-sm text-muted-foreground">Kidding · {formatDay(birth.born_on)}</p>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        <Link href={`${base}/herd/${birth.dam_id}`} className="underline-offset-4 hover:underline">
          {labels.get(birth.dam_id) ?? "Doe"}
        </Link>
      </h1>
      <Card>
        <CardContent className="text-sm">
          <p>
            {alive.length} born alive{offspring.length > alive.length ? `, ${offspring.length - alive.length} stillborn` : ""}
            {birth.assisted ? " · the doe needed help" : ""}
          </p>
          {birth.notes && <p className="mt-2 whitespace-pre-line">{birth.notes}</p>}
          {birth.mating_id && (
            <Link href={`${base}/breeding/matings/${birth.mating_id}`} className="mt-2 inline-block text-primary underline-offset-4 hover:underline">
              See the mating
            </Link>
          )}
        </CardContent>
      </Card>
      <ul className="mt-4 grid gap-2">
        {offspring.map((o) => (
          <li key={o.id}>
            {o.animal_id && labels.get(o.animal_id) ? (
              <Link href={`${base}/herd/${o.animal_id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent">
                <span className="min-w-0 flex-1 truncate font-medium">{labels.get(o.animal_id)}</span>
                <span className="text-sm text-muted-foreground">
                  {o.sex ? SEX_LABEL[o.sex] : ""}
                  {o.birth_weight_kg ? ` · ${o.birth_weight_kg} kg` : ""}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            ) : (
              <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                Kid {o.position}: {o.born_alive ? "record removed" : "stillborn"}
                {o.sex ? ` · ${SEX_LABEL[o.sex]}` : ""}
                {o.birth_weight_kg ? ` · ${o.birth_weight_kg} kg` : ""}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
