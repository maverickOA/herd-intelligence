import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Baby, ChevronRight, ClipboardCheck, ListOrdered, Scale, ShieldCheck, Stethoscope } from "lucide-react";
import { ClassBadge } from "@/components/breeding/class-badge";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMatings, getPolicy, getRecentAssessments, getRecentBirths, labelsFor, type MatingRow } from "@/lib/breeding";
import { getOrgContext } from "@/lib/data";
import { METHOD_SHORT, daysUntil, formatDay, pct } from "@/lib/labels";

export const metadata: Metadata = { title: "Breeding" };

export default async function BreedingPage({ params }: PageProps<"/o/[orgId]/breeding">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const [policy, open, checks, births] = await Promise.all([
    getPolicy(orgId),
    getMatings(orgId, { outcomes: ["awaiting_check", "pregnant"] }),
    getRecentAssessments(orgId, 8),
    getRecentBirths(orgId, 6),
  ]);
  const labels = await labelsFor(checks.flatMap((c) => [c.buck_id, c.doe_id]));
  const base = `/o/${orgId}/breeding`;
  const awaiting = open.filter((m) => m.outcome === "awaiting_check");
  const pregnant = open
    .filter((m) => m.outcome === "pregnant")
    .sort((a, b) => (a.scanDue ?? a.dueFrom).localeCompare(b.scanDue ?? b.dueFrom));

  return (
    <>
      <PageHeader title="Breeding" description="Check pairings before mating, then follow each doe through to kidding." />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Action href={`${base}/check`} icon={Scale} title="Check a pairing" text="One buck and one doe" />
        <Action href={`${base}/rank`} icon={ListOrdered} title="Best bucks for a doe" text="All your bucks, ranked" />
        <Action href={`${base}/mate`} icon={ClipboardCheck} title="Record a mating" text="Checked before saving" />
        <Action href={`${base}/kidding`} icon={Baby} title="Record a kidding" text="Registers the kids" />
      </div>

      {policy && !policy.advisor_confirmed_on && (
        <Alert className="mt-4">
          <AlertTriangle aria-hidden />
          <AlertTitle>Risk thresholds not yet confirmed by an advisor</AlertTitle>
          <AlertDescription>
            <p>
              Checks use starting values (high risk from {pct(policy.high_band_min)}, restricted from {pct(policy.max_coi)} or for
              parent–offspring and sibling pairings). Have a qualified breeding advisor confirm them.{" "}
              <Link href={`${base}/policy`} className="font-medium text-primary underline-offset-4 hover:underline">
                {ctx.role === "owner" ? "Review the policy" : "See the policy"}
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Section title="Due to kid" empty="No pregnant does recorded." count={pregnant.length}>
        {pregnant.map((m) => {
          const due = m.scanDue ?? m.dueFrom;
          const days = daysUntil(due);
          return (
            <MatingLink key={m.id} orgId={orgId} m={m}>
              {m.scanDue
                ? `Due about ${formatDay(m.scanDue)} (from the scan)`
                : `Due about ${formatDay(m.dueFrom)}${m.dueTo !== m.dueFrom ? `–${formatDay(m.dueTo)}` : ""}`}
              {" · "}
              <span className={days < 0 ? "font-medium text-destructive" : days <= 14 ? "font-medium" : undefined}>
                {days < 0 ? `${-days} day${days === -1 ? "" : "s"} past` : days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}
              </span>
            </MatingLink>
          );
        })}
      </Section>

      <Section title="Awaiting pregnancy check" empty="No matings waiting for a check." count={awaiting.length}>
        {awaiting.map((m) => {
          const since = -daysUntil(m.started_on);
          return (
            <MatingLink key={m.id} orgId={orgId} m={m}>
              {METHOD_SHORT[m.method]} {formatDay(m.started_on)} · {since} day{since === 1 ? "" : "s"} ago
              {since >= 30 && " · ready for a scan"}
            </MatingLink>
          );
        })}
      </Section>

      <Section title="Recent kiddings" empty="No kiddings recorded yet." count={births.length}>
        {births.map((b) => (
          <li key={b.id}>
            <Link href={`${base}/kiddings/${b.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent">
              <Baby className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.dam}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {formatDay(b.born_on)} · {b.alive} live kid{b.alive === 1 ? "" : "s"}
                  {b.stillborn ? `, ${b.stillborn} stillborn` : ""}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </Section>

      <Section title="Recent checks" empty="No pairings checked yet." count={checks.length}>
        {checks.map((c) => (
          <li key={c.id}>
            <Link href={`${base}/assessments/${c.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {labels.get(c.buck_id) ?? "Buck"} × {labels.get(c.doe_id) ?? "Doe"}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  COI {pct(c.classified_coi)} · completeness {pct(c.completeness, 0)} · {formatDay(c.created_at.slice(0, 10))}
                </p>
                <ClassBadge value={c.classification} possible={c.possible} className="mt-1.5" />
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </Section>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button asChild variant="outline" className="h-11">
          <Link href={`${base}/policy`}>
            <ShieldCheck aria-hidden /> Breeding policy
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href={`${base}/matings`}>
            <Stethoscope aria-hidden /> All matings
          </Link>
        </Button>
      </div>
    </>
  );
}

function Action({ href, icon: Icon, title, text }: { href: string; icon: React.ElementType; title: string; text: string }) {
  return (
    <Link href={href} className="flex min-h-24 flex-col justify-between gap-2 rounded-xl border bg-card p-3 hover:bg-accent">
      <Icon className="size-5 text-primary" aria-hidden />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </Link>
  );
}

function Section({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {count === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">{empty}</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-2">{children}</ul>
      )}
    </section>
  );
}

function MatingLink({ orgId, m, children }: { orgId: string; m: MatingRow; children: React.ReactNode }) {
  const sires = m.sires.map((s) => s.label ?? "a buck you can't see").join(", ");
  return (
    <li>
      <Link href={`/o/${orgId}/breeding/matings/${m.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {m.dam ? `${m.dam.tag ?? m.dam.name ?? "Doe"}${m.dam.tag && m.dam.name ? ` · ${m.dam.name}` : ""}` : "Doe"} × {sires}
          </p>
          <p className="text-sm text-muted-foreground">{children}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
