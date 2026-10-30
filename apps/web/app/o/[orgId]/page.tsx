import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, PawPrint, Warehouse, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFarms, getOpenInvitations, getOrgContext, getTeam, isOwner } from "@/lib/data";
import { countAnimals } from "@/lib/herd";
import { ROLE_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Home" };

export default async function OrgHome({ params }: PageProps<"/o/[orgId]">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const owner = isOwner(ctx);
  const [farms, team, invitations, herdSize] = await Promise.all([
    getFarms(orgId),
    getTeam(orgId),
    owner ? getOpenInvitations(orgId) : Promise.resolve([]),
    countAnimals(orgId),
  ]);
  const penTotal = farms.reduce((n, f) => n + f.penCount, 0);
  const activeMembers = team.filter((m) => m.status === "active").length;
  const base = `/o/${orgId}`;

  const steps = [
    { done: true, label: "Create your organization", href: `${base}/settings` },
    { done: farms.length > 0, label: "Add your first farm", href: `${base}/farms` },
    { done: penTotal > 0, label: "Add pens to a farm", href: farms[0] ? `${base}/farms/${farms[0].id}` : `${base}/farms` },
    { done: herdSize > 0, label: "Register your first animal", href: `${base}/herd/new` },
    { done: team.length > 1 || invitations.length > 0, label: "Invite your team", href: `${base}/team` },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <>
      <PageHeader
        title={ctx.org.name}
        description={
          <>
            You&apos;re signed in as <Badge variant="secondary">{ROLE_LABEL[ctx.role]}</Badge>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat href={`${base}/herd`} icon={PawPrint} label={herdSize === 1 ? "Animal" : "Animals"} value={herdSize} />
        <Stat href={`${base}/farms`} icon={Warehouse} label={farms.length === 1 ? "Farm" : "Farms"} value={farms.length} />
        <Stat href={`${base}/team`} icon={Users} label={activeMembers === 1 ? "Person" : "People"} value={activeMembers} />
      </div>

      {owner && remaining > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Get set up</CardTitle>
            <CardDescription>
              {remaining} step{remaining === 1 ? "" : "s"} left to get your farm running here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link
                    href={s.href}
                    className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm hover:bg-accent"
                  >
                    {s.done ? (
                      <CheckCircle2 className="size-5 text-primary" aria-label="Done" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" aria-label="To do" />
                    )}
                    <span className={s.done ? "text-muted-foreground line-through" : "font-medium"}>{s.label}</span>
                    {!s.done && <ArrowRight className="ml-auto size-4 text-muted-foreground" aria-hidden />}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">What&apos;s coming</CardTitle>
          <CardDescription>
            Herd Intelligence is being built in stages. These arrive next, in this order:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid list-decimal gap-2 pl-5 text-sm">
            <li>
              <span className="font-medium">Breeding checks</span>: inbreeding risk before every mating, ranking bucks
              for a doe, matings, pregnancy checks and kidding records.
            </li>
            <li>
              <span className="font-medium">Works offline</span>: record in the pen, sync when you have signal.
            </li>
            <li>
              <span className="font-medium">Reports and import</span>: pedigree certificates for buyers, exports, and
              spreadsheet import.
            </li>
          </ol>
        </CardContent>
      </Card>
    </>
  );
}

function Stat({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent">
      <Icon className="size-4 text-muted-foreground" />
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}
