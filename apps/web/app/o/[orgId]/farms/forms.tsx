"use client";

import { useActionState, useState } from "react";
import { Archive, Pencil, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Field, FieldErrorText, FormMessage, SubmitButton } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialState } from "@/lib/action-state";
import { Constants, type Enums } from "@/lib/database.types";
import { PEN_TYPE_LABEL } from "@/lib/labels";
import { addFarm, addPen, archivePen, updateFarm, updatePen } from "../actions";

export function AddFarmForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState(addFarm, initialState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="orgId" value={orgId} />
      <FormMessage state={state} />
      <Field label="Farm name" name="name" placeholder="e.g. Kulende annex" required state={state} />
      <Field label="Address or directions (optional)" name="address" placeholder="Town, landmark" state={state} />
      <SubmitButton className="h-11 sm:w-fit" pendingText="Adding…">
        Add farm
      </SubmitButton>
    </form>
  );
}

export function FarmDetailsForm({
  orgId,
  farm,
}: {
  orgId: string;
  farm: { id: string; name: string; address: string | null };
}) {
  const [state, action] = useActionState(updateFarm, initialState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="farmId" value={farm.id} />
      <FormMessage state={state} />
      <Field label="Farm name" name="name" defaultValue={farm.name} required state={state} />
      <Field label="Address or directions" name="address" defaultValue={farm.address ?? ""} state={state} />
      <SubmitButton className="h-11 sm:w-fit" pendingText="Saving…">
        Save details
      </SubmitButton>
    </form>
  );
}

function PenFields({
  state,
  pen,
}: {
  state: typeof initialState;
  pen?: { name: string; pen_type: Enums<"pen_type">; capacity: number | null };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_12rem_8rem]">
      <Field label="Name" name="name" defaultValue={pen?.name} placeholder="e.g. Pen A" required state={state} />
      <div className="grid gap-1.5">
        <Label htmlFor={pen ? undefined : "pen-type"}>Type</Label>
        <NativeSelect id={pen ? undefined : "pen-type"} name="penType" defaultValue={state.values?.penType ?? pen?.pen_type ?? "pen"}>
          {Constants.public.Enums.pen_type.map((t) => (
            <option key={t} value={t}>
              {PEN_TYPE_LABEL[t]}
            </option>
          ))}
        </NativeSelect>
        <FieldErrorText state={state} name="penType" />
      </div>
      <Field
        label="Capacity"
        name="capacity"
        type="number"
        inputMode="numeric"
        min={1}
        defaultValue={pen?.capacity?.toString() ?? ""}
        placeholder="Head"
        state={state}
      />
    </div>
  );
}

export function AddPenForm({ orgId, farmId }: { orgId: string; farmId: string }) {
  // React resets the form after each submission; on error the fields refill from state.values.
  return (
    <ActionForm action={addPen} hidden={{ orgId, farmId }} className="grid gap-4">
      {(state) => (
        <>
          <PenFields state={state} />
          <SubmitButton className="h-11 sm:w-fit" pendingText="Adding…">
            Add pen
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PenRow({
  orgId,
  farmId,
  pen,
  canManage,
}: {
  orgId: string;
  farmId: string;
  pen: { id: string; name: string; pen_type: Enums<"pen_type">; capacity: number | null };
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="min-w-0 rounded-xl border bg-card p-4">
        <ActionForm
          action={updatePen}
          hidden={{ orgId, farmId, penId: pen.id }}
          className="grid gap-4"
          onDone={() => setEditing(false)}
        >
          {(state) => (
            <>
              <PenFields state={state} pen={pen} />
              <div className="flex gap-2">
                <SubmitButton className="h-11" pendingText="Saving…">
                  Save
                </SubmitButton>
                <Button type="button" variant="ghost" className="h-11" onClick={() => setEditing(false)}>
                  <X aria-hidden /> Cancel
                </Button>
              </div>
            </>
          )}
        </ActionForm>
      </li>
    );
  }

  return (
    <li className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{pen.name}</p>
        <p className="text-sm text-muted-foreground">
          {PEN_TYPE_LABEL[pen.pen_type]}
          {pen.capacity ? ` · up to ${pen.capacity} head` : ""}
        </p>
      </div>
      {canManage && (
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" className="size-11" onClick={() => setEditing(true)} aria-label={`Edit ${pen.name}`}>
            <Pencil aria-hidden />
          </Button>
          <ActionForm
            action={archivePen}
            hidden={{ orgId, penId: pen.id }}
            confirm={`Archive ${pen.name}? It will be hidden from lists but kept in records.`}
          >
            <SubmitButton variant="ghost" size="icon" className="size-11">
              <Archive aria-hidden />
              <span className="sr-only">Archive {pen.name}</span>
            </SubmitButton>
          </ActionForm>
        </div>
      )}
    </li>
  );
}
