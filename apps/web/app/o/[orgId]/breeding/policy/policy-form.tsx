"use client";

import { ActionForm } from "@/components/action-form";
import { Field, FieldErrorText, SubmitButton } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RELATIONSHIPS } from "@/lib/labels";
import { policyAction } from "../actions";


export type PolicyValues = {
  lowBandMax: string;
  highBandMin: string;
  maxCoi: string;
  minCompleteness: string;
  generations: string;
  blocked: string[];
  allowFounderAssumption: boolean;
  advisorName: string;
  advisorNote: string;
  advisorConfirmedOn: string;
};

export function PolicyForm({ orgId, p, today }: { orgId: string; p: PolicyValues; today: string }) {
  return (
    <ActionForm action={policyAction} hidden={{ orgId }} className="grid gap-5">
      {(state) => {
        const v = (k: keyof PolicyValues) => state.values?.[k] ?? (p[k] as string);
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field state={state} name="lowBandMax" label="Low risk below (%)" defaultValue={v("lowBandMax")} inputMode="decimal" required />
              <Field state={state} name="highBandMin" label="High risk from (%)" defaultValue={v("highBandMin")} inputMode="decimal" required />
              <Field state={state} name="maxCoi" label="Restricted from (%)" defaultValue={v("maxCoi")} inputMode="decimal" required hint="Needs a reason from an owner or manager" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field state={state} name="minCompleteness" label="Minimum completeness (%)" defaultValue={v("minCompleteness")} inputMode="numeric" required />
              <div className="grid gap-1.5">
                <Label htmlFor="generations">Generations counted</Label>
                <NativeSelect id="generations" name="generations" defaultValue={v("generations")} key={v("generations")}>
                  {[2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      {g} (buck and doe = 1)
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Always restricted, whatever the COI</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {RELATIONSHIPS.map((r) => (
                  <label key={r.code} className="flex min-h-10 items-center gap-2 text-sm">
                    <input type="checkbox" name="blocked" value={r.code} defaultChecked={p.blocked.includes(r.code)} className="size-4 accent-[var(--primary)]" />
                    {r.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="allowFounderAssumption" defaultChecked={p.allowFounderAssumption} className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span>
                Count animals marked as founders as complete pedigree (their unknown ancestors are assumed unrelated). Results that rely on this say so.
              </span>
            </label>

            <div className="grid gap-4 rounded-xl border p-4">
              <p className="text-sm font-medium">Advisor sign-off</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field state={state} name="advisorName" label="Breeding advisor" defaultValue={v("advisorName")} placeholder="e.g. Dr A. Bello, animal geneticist" />
                <Field state={state} name="advisorConfirmedOn" label="Confirmed these values on" type="date" max={today} defaultValue={v("advisorConfirmedOn")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="advisorNote">Advisor&apos;s note (optional)</Label>
                <Textarea id="advisorNote" name="advisorNote" rows={2} defaultValue={v("advisorNote")} />
                <FieldErrorText state={state} name="advisorNote" />
              </div>
              <p className="text-xs text-muted-foreground">Changing any threshold clears the confirmation date until the advisor confirms again.</p>
            </div>

            <SubmitButton className="h-11 w-full sm:w-fit" pendingText="Saving…">
              Save policy
            </SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
