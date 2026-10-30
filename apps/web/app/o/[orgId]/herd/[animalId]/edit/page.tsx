import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getOrgContext } from "@/lib/data";
import { canEditAnimal, canRegisterOn, getAnimal, getBreeds, getFarmsAndPens } from "@/lib/herd";
import { animalLabel } from "@/lib/labels";
import { AnimalForm } from "../../animal-form";

export const metadata: Metadata = { title: "Edit animal" };

export default async function EditAnimalPage({ params }: PageProps<"/o/[orgId]/herd/[animalId]/edit">) {
  const { orgId, animalId } = await params;
  const ctx = await getOrgContext(orgId);
  const animal = await getAnimal(orgId, animalId);
  if (!canEditAnimal(ctx, animal.farm_id)) notFound();
  const [{ farms, pens }, breeds] = await Promise.all([getFarmsAndPens(orgId), getBreeds(orgId)]);
  // Managers can move an animal only between farms they manage.
  const movable = farms.filter((f) => ctx.role === "owner" || (canRegisterOn(ctx, f.id) && ctx.role === "manager"));

  return (
    <>
      <Link href={`/o/${orgId}/herd/${animal.id}`} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> {animalLabel(animal)}
      </Link>
      <PageHeader title="Edit animal" description="Parents and purchase details are changed on the profile page." />
      <Card>
        <CardContent>
          <AnimalForm
            orgId={orgId}
            currency={ctx.org.currency_code}
            farms={movable}
            pens={pens}
            breeds={breeds}
            registerFarmIds={movable.map((f) => f.id)}
            canEditPedigree
            animal={animal}
          />
        </CardContent>
      </Card>
    </>
  );
}
