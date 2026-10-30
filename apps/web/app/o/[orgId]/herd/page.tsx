import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getOrgContext } from "@/lib/data";
import { canRegisterOn, getAnimals, getBreeds, getFarmsAndPens, type HerdFilter } from "@/lib/herd";
import { GONE_STATUSES, SEX_LABEL, STATUS_LABEL, ageText, animalLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Herd" };

const VIEWS: { value: NonNullable<HerdFilter["view"]>; label: string }[] = [
  { value: "herd", label: "In the herd" },
  { value: "gone", label: "Sold or gone" },
  { value: "records", label: "Ancestors on record" },
  { value: "all", label: "Everything" },
];

export default async function HerdPage({ params, searchParams }: PageProps<"/o/[orgId]/herd">) {
  const { orgId } = await params;
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const filter: HerdFilter = {
    q: pick("q"),
    sex: pick("sex") === "male" || pick("sex") === "female" ? (pick("sex") as HerdFilter["sex"]) : undefined,
    view: VIEWS.some((v) => v.value === pick("view")) ? (pick("view") as HerdFilter["view"]) : "herd",
    farm: pick("farm"),
  };

  const ctx = await getOrgContext(orgId);
  const [animals, { farms, pens }, breeds] = await Promise.all([getAnimals(orgId, filter), getFarmsAndPens(orgId), getBreeds(orgId)]);
  const farmName = new Map(farms.map((f) => [f.id, f.name]));
  const penName = new Map(pens.map((p) => [p.id, p.name]));
  const breedName = new Map(breeds.map((b) => [b.id, b.name]));
  const canRegister = farms.some((f) => canRegisterOn(ctx, f.id));
  const base = `/o/${orgId}/herd`;
  const filtered = !!(filter.q || filter.sex || filter.farm);

  const counts = {
    bucks: animals.filter((a) => a.sex === "male").length,
    does: animals.filter((a) => a.sex === "female").length,
  };

  return (
    <>
      <PageHeader
        title="Herd"
        description={
          animals.length
            ? `${animals.length} animal${animals.length === 1 ? "" : "s"} · ${counts.bucks} buck${counts.bucks === 1 ? "" : "s"}, ${counts.does} doe${counts.does === 1 ? "" : "s"}`
            : undefined
        }
        action={
          canRegister && (
            <Button asChild className="h-11">
              <Link href={`${base}/new`}>
                <Plus aria-hidden /> Register animal
              </Link>
            </Button>
          )
        }
      />

      <nav aria-label="Herd views" className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
        {VIEWS.map((v) => {
          const qs = new URLSearchParams({ ...(filter.q ? { q: filter.q } : {}), view: v.value });
          const active = filter.view === v.value;
          return (
            <Link
              key={v.value}
              href={`${base}?${qs}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-full border px-3 text-sm",
                active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {v.label}
            </Link>
          );
        })}
      </nav>

      <form method="get" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_10rem_12rem_auto]" role="search">
        <input type="hidden" name="view" value={filter.view} />
        <div className="relative col-span-2 sm:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={filter.q ?? ""} placeholder="Tag, name or registration no." aria-label="Search the herd" className="h-11 pl-9" />
        </div>
        <NativeSelect name="sex" defaultValue={filter.sex ?? ""} aria-label="Sex">
          <option value="">Bucks and does</option>
          <option value="male">Bucks</option>
          <option value="female">Does</option>
        </NativeSelect>
        {filter.view !== "records" && farms.length > 1 ? (
          <NativeSelect name="farm" defaultValue={filter.farm ?? ""} aria-label="Farm">
            <option value="">All farms</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <span className="hidden sm:block" />
        )}
        <Button type="submit" variant="secondary" className={cn("h-11", !(filter.view !== "records" && farms.length > 1) && "sm:col-start-4")}>
          Filter
        </Button>
      </form>

      {animals.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {filtered ? (
              <>
                No animals match. <Link className="text-primary underline-offset-4 hover:underline" href={`${base}?view=${filter.view}`}>Clear the filters</Link>
              </>
            ) : filter.view === "records" ? (
              "No ancestors on record yet. Add them from an animal's profile with “Add from papers”."
            ) : filter.view === "gone" ? (
              "No animals have been sold or lost."
            ) : canRegister ? (
              <>
                No animals yet.{" "}
                <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`${base}/new`}>
                  Register your first one
                </Link>
                .
              </>
            ) : (
              "No animals on the farms you can see yet."
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {animals.map((a) => {
            const age = ageText(a.birth_date, a.birth_date_estimated);
            const gone = GONE_STATUSES.includes(a.status);
            return (
              <li key={a.id} className="min-w-0">
                <Link href={`${base}/${a.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      a.sex === "male" ? "bg-primary/15 text-primary" : "bg-warning/20 text-foreground",
                    )}
                  >
                    {SEX_LABEL[a.sex][0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{animalLabel(a)}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[
                        SEX_LABEL[a.sex],
                        a.breed_id ? breedName.get(a.breed_id) : null,
                        age,
                        a.farm_id ? [farmName.get(a.farm_id), a.pen_id ? penName.get(a.pen_id) : null].filter(Boolean).join(", ") : "Records only",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {a.farm_id && a.status !== "active" && (
                    <Badge variant={gone ? "outline" : "secondary"} className="shrink-0">
                      {STATUS_LABEL[a.status]}
                    </Badge>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
