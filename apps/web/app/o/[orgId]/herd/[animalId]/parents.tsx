"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Constants, type Enums } from "@/lib/database.types";
import { CONFIDENCE_LABEL } from "@/lib/labels";
import { setParentAction } from "../actions";

type Option = { id: string; label: string; sex: Enums<"animal_sex"> };

export type ParentView = {
  role: Enums<"parent_role">;
  parentId: string | null;
  label: string | null;
  hidden: boolean;
  confidence: Enums<"parent_confidence"> | null;
  evidence: string | null;
};

export function ParentRow({
  orgId,
  childId,
  current,
  options,
  canEdit,
}: {
  orgId: string;
  childId: string;
  current: ParentView;
  options: Option[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const word = current.role === "sire" ? "Sire" : "Dam";
  const sex = current.role === "sire" ? "male" : "female";
  const choices = options.filter((o) => o.sex === sex && o.id !== childId);

  if (editing) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <ActionForm
          action={setParentAction}
          hidden={{ orgId, childId, role: current.role }}
          className="grid gap-3"
          onDone={() => setEditing(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`${current.role}-parent`}>{word}</Label>
              <NativeSelect id={`${current.role}-parent`} name="parentId" defaultValue={current.parentId ?? ""}>
                <option value="">Unknown</option>
                {choices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${current.role}-confidence`}>How do you know?</Label>
              <NativeSelect id={`${current.role}-confidence`} name="confidence" defaultValue={current.confidence ?? "reported"}>
                {Constants.public.Enums.parent_confidence.map((c) => (
                  <option key={c} value={c}>
                    {CONFIDENCE_LABEL[c]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${current.role}-evidence`}>Evidence (optional)</Label>
            <Input id={`${current.role}-evidence`} name="evidence" defaultValue={current.evidence ?? ""} placeholder="e.g. seller's certificate no. 1234" className="h-11" />
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton className="h-11" pendingText="Saving…">
              Save {word.toLowerCase()}
            </SubmitButton>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setEditing(false)}>
              <X aria-hidden /> Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Changing a {word.toLowerCase()} keeps the old link in the history. Not listed?{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href={`/o/${orgId}/herd/new?childOf=${childId}&role=${current.role}`}>
              Add one from papers
            </Link>
            .
          </p>
        </ActionForm>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{word}</p>
        {current.parentId ? (
          current.hidden ? (
            <p className="text-sm text-muted-foreground">Recorded, but on a farm you can&apos;t see</p>
          ) : (
            <Link href={`/o/${orgId}/herd/${current.parentId}`} className="block truncate font-medium text-primary underline-offset-4 hover:underline">
              {current.label}
            </Link>
          )
        ) : (
          <p className="text-muted-foreground">Unknown</p>
        )}
        {current.confidence && <p className="text-xs text-muted-foreground">{CONFIDENCE_LABEL[current.confidence]}{current.evidence ? ` · ${current.evidence}` : ""}</p>}
      </div>
      {canEdit && (
        <div className="flex shrink-0 gap-1">
          {!current.parentId && (
            <Button asChild variant="outline" className="h-11">
              <Link href={`/o/${orgId}/herd/new?childOf=${childId}&role=${current.role}`}>
                <Plus aria-hidden /> From papers
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-11" onClick={() => setEditing(true)} aria-label={`${current.parentId ? "Change" : "Choose"} ${word.toLowerCase()}`}>
            <Pencil aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
