"use client";

import { ActionForm } from "@/components/action-form";
import { FieldErrorText, SubmitButton } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Constants } from "@/lib/database.types";
import { PREG_METHOD_LABEL, PREG_RESULT_LABEL } from "@/lib/labels";
import { pregnancyCheckAction } from "../../actions";

export function PregnancyForm({ orgId, doeId, matingId, minDate, today }: { orgId: string; doeId: string; matingId: string; minDate: string; today: string }) {
  return (
    <ActionForm action={pregnancyCheckAction} hidden={{ orgId, doeId, matingId }} className="grid gap-4">
      {(state) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="checkedOn">Checked on</Label>
              <Input id="checkedOn" name="checkedOn" type="date" min={minDate} max={today} defaultValue={state.values?.checkedOn || today} required className="h-11" />
              <FieldErrorText state={state} name="checkedOn" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="method">How</Label>
              <NativeSelect id="method" name="method" defaultValue={state.values?.method || "ultrasound"}>
                {Constants.public.Enums.pregnancy_method.map((m) => (
                  <option key={m} value={m}>
                    {PREG_METHOD_LABEL[m]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="result">Result</Label>
              <NativeSelect id="result" name="result" defaultValue={state.values?.result || "pregnant"} key={`r-${state.values?.result}`}>
                {Constants.public.Enums.pregnancy_result.map((r) => (
                  <option key={r} value={r}>
                    {PREG_RESULT_LABEL[r]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="dueOn">Due date from the scan (if pregnant, optional)</Label>
            <Input id="dueOn" name="dueOn" type="date" defaultValue={state.values?.dueOn ?? ""} className="h-11" />
            <FieldErrorText state={state} name="dueOn" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pc-notes">Notes (optional)</Label>
            <Textarea id="pc-notes" name="notes" rows={2} defaultValue={state.values?.notes ?? ""} />
          </div>
          <SubmitButton className="h-11 w-full sm:w-fit" pendingText="Saving…">
            Save pregnancy check
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
