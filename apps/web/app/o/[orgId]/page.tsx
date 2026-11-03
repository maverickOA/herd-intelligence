import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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

      <div className="grid grid-cols-3 divide-x overflow-hidden rounded-xl border bg-card">
        <Stat href={`${base}/herd`} label={herdSize === 1 ? "Animal" : "Animals"} value={herdSize} />
        <Stat href={`${base}/farms`} label={farms.length === 1 ? "Farm" : "Farms"} value={farms.length} />
        <Stat href={`${base}/team`} label={activeMembers === 1 ? "Person" : "People"} value={activeMembers} />
      </div>

      {owner && remaining > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[0.9375rem] font-semibold">Get set up</h2>
            <p className="text-sm text-muted-foreground tabular-nums">
              {steps.length - remaining} of {steps.length} done
            </p>
          </div>
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-foreground" style={{ width: `${((steps.length - remaining) / steps.length) * 100}%` }} />
          </div>
          <ul className="rows grid">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex min-h-12 items-center gap-3 border bg-card px-3.5 text-sm transition-colors hover:bg-accent">
                  {s.done ? (
                    <CheckCircle2 className="size-[1.125rem] text-success" aria-label="Done" />
                  ) : (
                    <Circle className="size-[1.125rem] text-muted-foreground/60" aria-label="To do" />
                  )}
                  <span className={s.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "font-medium"}>{s.label}</span>
                  {!s.done && <ArrowRight className="ml-auto size-4 text-muted-foreground" aria-hidden />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-1 text-[0.9375rem] font-semibold">What&apos;s next</h2>
        <p className="mb-4 text-sm text-muted-foreground">Herd Intelligence ships in stages. These arrive next, in this order.</p>
        <ol className="grid gap-px overflow-hidden rounded-xl border bg-border">
          {ROADMAP.map((r, i) => (
            <li key={r.title} className="flex gap-4 bg-card p-4">
              <span className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">0{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{r.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

const ROADMAP = [
  { title: "Works offline", text: "Record in the pen, sync when you have signal." },
  { title: "Reports and import", text: "Pedigree certificates for buyers, exports, and spreadsheet import." },
];

function Stat({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="group px-4 py-4 transition-colors hover:bg-accent md:px-5 md:py-5">
      <p className="text-xs text-muted-foreground group-hover:text-foreground">{label}</p>
      <p className="mt-1.5 text-[1.75rem] leading-none font-semibold tracking-[-0.03em] tabular-nums md:text-[2rem]">{value}</p>
    </Link>
  );
}
