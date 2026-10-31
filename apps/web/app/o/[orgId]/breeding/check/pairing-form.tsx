"use client";

import { useActionState } from "react";
import { FieldErrorText, FormMessage, SubmitButton } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { initialState } from "@/lib/action-state";
import { checkPairingAction } from "../actions";

type Option = { id: string; label: string };

export function PairingForm({ orgId, bucks, does, buckId, doeId }: { orgId: string; bucks: Option[]; does: Option[]; buckId?: string; doeId?: string }) {
  const [state, action] = useActionState(checkPairingAction, initialState);
  const v = state.values ?? {};
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="orgId" value={orgId} />
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="buckId">Buck</Label>
          <NativeSelect id="buckId" name="buckId" defaultValue={v.buckId ?? buckId ?? ""} key={`b-${v.buckId ?? buckId}`} required>
            <option value="" disabled>
              Choose a buck
            </option>
            {bucks.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          <FieldErrorText state={state} name="buckId" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="doeId">Doe</Label>
          <NativeSelect id="doeId" name="doeId" defaultValue={v.doeId ?? doeId ?? ""} key={`d-${v.doeId ?? doeId}`} required>
            <option value="" disabled>
              Choose a doe
            </option>
            {does.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          <FieldErrorText state={state} name="doeId" />
        </div>
      </div>
      <SubmitButton className="h-11 w-full sm:w-auto" pendingText="Checking the pedigree…">
        Check pairing
      </SubmitButton>
    </form>
  );
}
