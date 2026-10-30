import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFarms, getOrgContext, isOwner } from "@/lib/data";
import { AddFarmForm } from "./forms";

export const metadata: Metadata = { title: "Farms" };

export default async function FarmsPage({ params }: PageProps<"/o/[orgId]/farms">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const farms = await getFarms(orgId);
  const owner = isOwner(ctx);

  return (
    <>
      <PageHeader
        title="Farms"
        description={owner ? "Every farm or location in your organization." : "The farms you have access to."}
      />

      {farms.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {owner
              ? "No farms yet. Add your first one below."
              : "You haven't been given access to any farms yet. Ask an owner to assign you one."}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {farms.map((f) => (
            <li key={f.id} className="min-w-0">
              <Link
                href={`/o/${orgId}/farms/${f.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                    {f.address ? (
                      <>
                        <MapPin className="size-3.5 shrink-0" aria-hidden />
                        {f.address}
                      </>
                    ) : (
                      "No address yet"
                    )}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {f.penCount} pen{f.penCount === 1 ? "" : "s"}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {owner && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Add a farm</CardTitle>
            <CardDescription>A separate site or location with its own pens and team.</CardDescription>
          </CardHeader>
          <CardContent>
            <AddFarmForm orgId={orgId} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
