import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getOrgContext } from "@/lib/data";
import type { Enums } from "@/lib/database.types";
import { canEditAnimal, canRegisterOn, getAnimal, getBreeds, getFarmsAndPens, getParentOptions } from "@/lib/herd";
import { animalLabel } from "@/lib/labels";
import { AnimalForm } from "../animal-form";

export const metadata: Metadata = { title: "Register an animal" };

export default async function NewAnimalPage({ params, searchParams }: PageProps<"/o/[orgId]/herd/new">) {
  const { orgId } = await params;
  const sp = await searchParams;
  const ctx = await getOrgContext(orgId);
  const [{ farms, pens }, breeds] = await Promise.all([getFarmsAndPens(orgId), getBreeds(orgId)]);
  const registerFarmIds = farms.filter((f) => canRegisterOn(ctx, f.id)).map((f) => f.id);
  // "Can edit pedigree" for a new animal: owners, or managers of at least one farm.
  const canEditPedigree = ctx.role === "owner" || (ctx.role === "manager" && ctx.assignedFarmIds.length > 0);

  // Adding an ancestor from another animal's profile.
  const childOf = typeof sp.childOf === "string" ? sp.childOf : undefined;
  const childRole = sp.role === "sire" || sp.role === "dam" ? (sp.role as Enums<"parent_role">) : undefined;
  const child = childOf && childRole ? await getAnimal(orgId, childOf) : null;
  const canLink = child ? canEditAnimal(ctx, child.farm_id) : false;

  const parentOptions = canEditPedigree && !child ? await getParentOptions(orgId) : [];
  const back = child ? `/o/${orgId}/herd/${child.id}` : `/o/${orgId}/herd`;

  return (
    <>
      <Link href={back} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> {child ? animalLabel(child) : "Herd"}
      </Link>
      <PageHeader
        title={child ? `Add ${childRole} from papers` : "Register an animal"}
        description={child ? "Record an ancestor you know from a seller's papers or registry." : "Takes about a minute. Only sex is required."}
      />
      <Card>
        <CardContent>
          {child && !canLink ? (
            <p className="text-sm text-muted-foreground">Only owners and the farm&apos;s managers can add ancestors.</p>
          ) : (
            <AnimalForm
              orgId={orgId}
              currency={ctx.org.currency_code}
              farms={farms}
              pens={pens}
              breeds={breeds}
              registerFarmIds={registerFarmIds}
              canEditPedigree={canEditPedigree}
              parentOptions={parentOptions}
              defaults={
                child
                  ? { origin: "pedigree_only", childOf: child.id, childRole, childLabel: animalLabel(child) }
                  : { farmId: typeof sp.farm === "string" ? sp.farm : undefined }
              }
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
