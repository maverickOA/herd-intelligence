import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFarms, getOpenInvitations, getOrgContext, getTeam, isOwner } from "@/lib/data";
import { ROLE_LABEL, formatDate } from "@/lib/labels";
import { revokeInvitation } from "../actions";
import { InviteCard, MemberCard } from "./forms";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: PageProps<"/o/[orgId]/team">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const owner = isOwner(ctx);
  const [team, farms, invitations] = await Promise.all([
    getTeam(orgId),
    getFarms(orgId),
    owner ? getOpenInvitations(orgId) : Promise.resolve([]),
  ]);
  const farmOptions = farms.map((f) => ({ id: f.id, name: f.name }));
  const farmName = new Map(farmOptions.map((f) => [f.id, f.name]));
  const tz = ctx.org.timezone;

  return (
    <>
      <PageHeader
        title="Team"
        description={owner ? "Who can see and work on your farms." : "People in this organization."}
      />

      {owner && <InviteCard orgId={orgId} orgName={ctx.org.name} farms={farmOptions} />}

      {owner && invitations.length > 0 && (
        <section aria-labelledby="pending-heading" className="mt-6">
          <h2 id="pending-heading" className="mb-3 text-lg font-semibold">
            Waiting to accept
          </h2>
          <ul className="grid gap-2">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{inv.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {ROLE_LABEL[inv.role]}
                    {inv.farm_ids.length > 0 &&
                      ` · ${inv.farm_ids.map((id) => farmName.get(id) ?? "removed farm").join(", ")}`}
                    {` · expires ${formatDate(inv.expires_at, tz)}`}
                  </p>
                </div>
                <ActionForm action={revokeInvitation} hidden={{ orgId, invitationId: inv.id }} confirm={`Cancel the invitation for ${inv.email}?`}>
                  <SubmitButton variant="ghost" className="h-11">
                    Cancel
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">
            Lost the link? Invite the same email again: a new link replaces the old one.
          </p>
        </section>
      )}

      <section aria-labelledby="members-heading" className="mt-6">
        <h2 id="members-heading" className="mb-3 text-lg font-semibold">
          Members <Badge variant="secondary">{team.length}</Badge>
        </h2>
        <ul className="grid gap-2">
          {team.map((m) => (
            <MemberCard
              key={m.membershipId}
              orgId={orgId}
              member={m}
              farms={farmOptions}
              viewerIsOwner={owner}
              isSelf={m.userId === ctx.user.id}
              timezone={tz}
            />
          ))}
        </ul>
      </section>

      {!owner && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Need access to another farm?</CardTitle>
            <CardDescription>Only an owner can change roles and farm access. Ask one of the owners above.</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}
    </>
  );
}
