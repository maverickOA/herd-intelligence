"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Phone, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/action-form";
import { Field, FieldErrorText, FormMessage, SubmitButton } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialState } from "@/lib/action-state";
import { Constants, type Enums } from "@/lib/database.types";
import type { TeamMember } from "@/lib/data";
import { ROLE_HELP, ROLE_LABEL, formatDate, initials } from "@/lib/labels";
import { changeRole, inviteMember, removeMember, setMemberStatus, updateAssignments } from "../actions";

type FarmOption = { id: string; name: string };

function FarmCheckboxes({ farms, selected, name = "farmIds" }: { farms: FarmOption[]; selected?: string[]; name?: string }) {
  if (farms.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a farm first, then you can give people access to it.</p>;
  }
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {farms.map((f) => (
        <label key={f.id} className="flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent">
          <input type="checkbox" name={name} value={f.id} defaultChecked={selected?.includes(f.id)} className="size-4 accent-[var(--primary)]" />
          {f.name}
        </label>
      ))}
    </div>
  );
}

export function InviteCard({ orgId, orgName, farms }: { orgId: string; orgName: string; farms: FarmOption[] }) {
  const [round, setRound] = useState(0);
  return <InviteForm key={round} orgId={orgId} orgName={orgName} farms={farms} onAnother={() => setRound((r) => r + 1)} />;
}

function InviteForm({
  orgId,
  orgName,
  farms,
  onAnother,
}: {
  orgId: string;
  orgName: string;
  farms: FarmOption[];
  onAnother: () => void;
}) {
  const [state, action] = useActionState(inviteMember, initialState);
  const [role, setRole] = useState<Enums<"member_role">>("worker");

  if (state.ok && state.data?.link) {
    return <InviteLink link={state.data.link} email={state.data.email ?? ""} orgName={orgName} message={state.message} onAnother={onAnother} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="size-4" aria-hidden /> Invite someone
        </CardTitle>
        <CardDescription>You&apos;ll get a link to send them by WhatsApp, SMS or email.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4" noValidate>
          <input type="hidden" name="orgId" value={orgId} />
          <FormMessage state={state} />
          <Field label="Their email address" name="email" type="email" inputMode="email" autoComplete="off" required state={state} />
          <div className="grid gap-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <NativeSelect id="invite-role" name="role" value={role} onChange={(e) => setRole(e.target.value as Enums<"member_role">)}>
              {Constants.public.Enums.member_role.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </NativeSelect>
            <p className="text-sm text-muted-foreground">{ROLE_HELP[role]}</p>
          </div>
          {role !== "owner" && (
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-sm font-medium">Farms they can access</legend>
              <FarmCheckboxes farms={farms} />
              <FieldErrorText state={state} name="farmIds" />
            </fieldset>
          )}
          <SubmitButton className="h-11 sm:w-fit" pendingText="Creating link…">
            Create invitation link
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

function InviteLink({
  link,
  email,
  orgName,
  message,
  onAnother,
}: {
  link: string;
  email: string;
  orgName: string;
  message?: string;
  onAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = `You're invited to join ${orgName} on Herd Intelligence. Open this link and sign up with ${email}: ${link}`;
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">Invitation ready</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex gap-2">
          <Input readOnly value={link} aria-label="Invitation link" className="h-11 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                toast.success("Link copied.");
              } catch {
                toast.error("Couldn't copy. Press and hold the link to copy it.");
              }
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild className="h-11">
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden /> Share on WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <a href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Join ${orgName} on Herd Intelligence`)}&body=${encodeURIComponent(text)}`}>
              <Mail aria-hidden /> Send by email
            </a>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          This is the only time the link is shown. If it gets lost, invite the same email again.
        </p>
        <Button type="button" variant="ghost" className="h-11 sm:w-fit" onClick={onAnother}>
          Invite someone else
        </Button>
      </CardContent>
    </Card>
  );
}

export function MemberCard({
  orgId,
  member,
  farms,
  viewerIsOwner,
  isSelf,
  timezone,
}: {
  orgId: string;
  member: TeamMember;
  farms: FarmOption[];
  viewerIsOwner: boolean;
  isSelf: boolean;
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  const farmNames = member.farmIds.map((id) => farms.find((f) => f.id === id)?.name).filter(Boolean);
  const hidden = { orgId, membershipId: member.membershipId };
  const name = member.fullName ?? member.email ?? "Unnamed member";

  return (
    <li className="min-w-0 rounded-xl border bg-card">
      <div className="flex items-start gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {initials(member.fullName, member.email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{name}</span>
            {isSelf && <Badge variant="outline">You</Badge>}
            {member.status === "suspended" && <Badge variant="destructive">Access paused</Badge>}
          </p>
          {member.email && member.fullName && <p className="truncate text-sm text-muted-foreground">{member.email}</p>}
          <p className="mt-1 text-sm">
            {ROLE_LABEL[member.role]}
            <span className="text-muted-foreground">
              {member.role === "owner"
                ? " · all farms"
                : farmNames.length
                  ? ` · ${farmNames.join(", ")}`
                  : " · no farms yet"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">Joined {formatDate(member.joinedAt, timezone)}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {member.phone && !isSelf && (
            <Button asChild variant="ghost" size="icon" className="size-11">
              <a href={`tel:${member.phone}`} aria-label={`Call ${name}`}>
                <Phone aria-hidden />
              </a>
            </Button>
          )}
          {(viewerIsOwner || isSelf) && (
            <Button variant="outline" className="h-11" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? "Done" : "Manage"}
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="grid gap-5 border-t p-4">
          {viewerIsOwner && (
            <ActionForm action={changeRole} hidden={hidden} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor={`role-${member.membershipId}`}>Role</Label>
                <NativeSelect id={`role-${member.membershipId}`} name="role" defaultValue={member.role}>
                  {Constants.public.Enums.member_role.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <SubmitButton variant="secondary" className="h-11" pendingText="Saving…">
                Change role
              </SubmitButton>
            </ActionForm>
          )}

          {viewerIsOwner && member.role !== "owner" && (
            <ActionForm action={updateAssignments} hidden={hidden} className="grid gap-2">
              <fieldset className="grid gap-2">
                <legend className="mb-1.5 text-sm font-medium">Farm access</legend>
                <FarmCheckboxes farms={farms} selected={member.farmIds} />
              </fieldset>
              <SubmitButton variant="secondary" className="h-11 sm:w-fit" pendingText="Saving…">
                Save farm access
              </SubmitButton>
            </ActionForm>
          )}

          <div className="flex flex-wrap gap-2">
            {viewerIsOwner && !isSelf && (
              <ActionForm
                action={setMemberStatus}
                hidden={{ ...hidden, status: member.status === "active" ? "suspended" : "active" }}
                confirm={member.status === "active" ? `Pause ${name}'s access? They keep their account but can't see this organization.` : undefined}
              >
                <SubmitButton variant="outline" className="h-11">
                  {member.status === "active" ? "Pause access" : "Restore access"}
                </SubmitButton>
              </ActionForm>
            )}
            <ActionForm
              action={removeMember}
              hidden={hidden}
              confirm={isSelf ? "Leave this organization? You'll need a new invitation to come back." : `Remove ${name} from the organization?`}
            >
              <SubmitButton variant="destructive" className="h-11">
                {isSelf ? "Leave organization" : "Remove"}
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      )}
    </li>
  );
}
