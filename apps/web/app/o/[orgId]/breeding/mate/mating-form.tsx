"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertOctagon } from "lucide-react";
import { ClassBadge } from "@/components/breeding/class-badge";
import { FieldErrorText, FormMessage, PendingButton, useNoResetSubmit } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialState } from "@/lib/action-state";
import { Constants, type Enums } from "@/lib/database.types";
import { METHOD_LABEL, pct } from "@/lib/labels";
import { labelize, sentence } from "@/lib/labelize";
import { matingAction, type MatingCheck } from "../actions";

type Doe = { id: string; label: string; canApprove: boolean };
type Buck = { id: string; label: string; recordsOnly: boolean };

export function MatingForm({
  orgId,
  does,
  bucks,
  labels,
  initialDoe,
  initialBuck,
  today,
}: {
  orgId: string;
  does: Doe[];
  bucks: Buck[];
  labels: Record<string, string>;
  initialDoe?: string;
  initialBuck?: string;
  today: string;
}) {
  const [state, action] = useActionState(matingAction, initialState);
  const { onSubmit, pending } = useNoResetSubmit(action);
  const v = state.values ?? {};
  const [doeId, setDoeId] = useState(initialDoe ?? "");
  const [method, setMethod] = useState<Enums<"mating_method">>(
    bucks.find((b) => b.id === initialBuck)?.recordsOnly ? "ai" : "hand",
  );
  const [buckIds, setBuckIds] = useState<string[]>(initialBuck ? [initialBuck] : []);

  const key = `${doeId}|${method}|${[...buckIds].join(",")}`;
  const checks: MatingCheck[] = useMemo(() => {
    try {
      return state.data?.checkedFor === key ? (JSON.parse(state.data.checks ?? "[]") as MatingCheck[]) : [];
    } catch {
      return [];
    }
  }, [state.data, key]);
  const checked = checks.length > 0;
  const restricted = checks.some((c) => c.classification === "restricted");
  const warning = checks.some((c) => ["restricted", "high", "insufficient"].includes(c.classification));
  const doe = does.find((d) => d.id === doeId);
  const blocked = restricted && !doe?.canApprove;
  const usable = bucks.filter((b) => method === "ai" || !b.recordsOnly);
  const many = method === "pasture";

  const setMethodSafe = (m: Enums<"mating_method">) => {
    setMethod(m);
    if (m !== "pasture") setBuckIds((ids) => ids.slice(0, 1));
    if (m !== "ai") setBuckIds((ids) => ids.filter((id) => !bucks.find((b) => b.id === id)?.recordsOnly));
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <input type="hidden" name="orgId" value={orgId} />
      <FormMessage state={state.ok ? {} : state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="doeId">Doe</Label>
          <NativeSelect id="doeId" name="doeId" value={doeId} onChange={(e) => setDoeId(e.target.value)} required>
            <option value="" disabled>
              Choose a doe
            </option>
            {does.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </NativeSelect>
          <FieldErrorText state={state} name="doeId" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="method">How</Label>
          <NativeSelect id="method" name="method" value={method} onChange={(e) => setMethodSafe(e.target.value as Enums<"mating_method">)}>
            {Constants.public.Enums.mating_method.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{many ? "Bucks running with her" : "Buck"}</legend>
        {many ? (
          <div className="grid max-h-64 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
            {usable.map((b) => (
              <label key={b.id} className="flex min-h-10 items-center gap-2 rounded px-2 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  name="buckIds"
                  value={b.id}
                  checked={buckIds.includes(b.id)}
                  onChange={(e) => setBuckIds((ids) => (e.target.checked ? [...ids, b.id] : ids.filter((x) => x !== b.id)))}
                  className="size-4 accent-[var(--primary)]"
                />
                {b.label}
              </label>
            ))}
          </div>
        ) : (
          <NativeSelect aria-label="Buck" name="buckIds" value={buckIds[0] ?? ""} onChange={(e) => setBuckIds(e.target.value ? [e.target.value] : [])} required>
            <option value="" disabled>
              Choose a buck
            </option>
            {usable.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
                {b.recordsOnly ? " (records only)" : ""}
              </option>
            ))}
          </NativeSelect>
        )}
        {many && <p className="text-sm text-muted-foreground">With several bucks the father is uncertain. Kids will list them all as possible sires, and checks use the worst case.</p>}
        <FieldErrorText state={state} name="buckIds" />
      </fieldset>

      {!checked ? (
        <>
        <input type="hidden" name="intent" value="check" />
        <PendingButton pending={pending} className="h-11 w-full sm:w-fit" pendingText="Checking the pedigree…">
          Check {many && buckIds.length > 1 ? "these pairings" : "this pairing"}
        </PendingButton>
        </>
      ) : (
        <>
          <input type="hidden" name="intent" value="record" />
          <input type="hidden" name="assessments" value={JSON.stringify(checks.map((c) => ({ sireId: c.sireId, assessmentId: c.assessmentId })))} />
          <input type="hidden" name="checks" value={state.data?.checks ?? ""} />
          <input type="hidden" name="checkedFor" value={state.data?.checkedFor ?? ""} />

          <section aria-label="Breeding check results" className="grid gap-2">
            {checks.map((c) => (
              <div key={c.sireId} className="rounded-xl border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{labels[c.sireId] ?? "Buck"}</span>
                  <ClassBadge value={c.classification as Enums<"breeding_class">} possible={c.possible} />
                </div>
                <p className="mt-1 text-muted-foreground">
                  Kid COI {c.coi}
                  {c.worst ? `, up to ${c.worst} if an uncertain sire is the father` : ""} · completeness {pct(c.completeness, 0)} ·{" "}
                  <a href={`/o/${orgId}/breeding/assessments/${c.assessmentId}`} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                    full details
                  </a>
                </p>
                {c.headline && <p className="mt-1">{sentence(labelize(c.headline, labels))}</p>}
              </div>
            ))}
          </section>

          {restricted && (
            <Alert variant="destructive">
              <AlertOctagon aria-hidden />
              <AlertDescription>
                {blocked
                  ? "This pairing is restricted by your farm's breeding policy. Only an owner or a manager of this farm can approve it. Ask them to record it, or choose another buck."
                  : "This pairing is restricted by your farm's breeding policy. To go ahead, give a written reason. It is saved with the mating and the check."}
              </AlertDescription>
            </Alert>
          )}

          {!blocked && (
            <>
              {restricted && (
                <div className="grid gap-1.5">
                  <Label htmlFor="reason">Reason for going ahead</Label>
                  <Textarea id="reason" name="reason" defaultValue={v.reason ?? ""} rows={3} minLength={10} required placeholder="e.g. Planned line-breeding agreed with our advisor; kids will not be sold as breeding stock." />
                  <FieldErrorText state={state} name="reason" />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="startedOn">{many ? "Bucks put in on" : "Date"}</Label>
                  <Input id="startedOn" name="startedOn" type="date" max={today} defaultValue={v.startedOn || today} required className="h-11" />
                  <FieldErrorText state={state} name="startedOn" />
                </div>
                {many && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="endedOn">Bucks taken out on (optional)</Label>
                    <Input id="endedOn" name="endedOn" type="date" defaultValue={v.endedOn ?? ""} className="h-11" />
                    <FieldErrorText state={state} name="endedOn" />
                  </div>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" name="notes" defaultValue={v.notes ?? ""} rows={2} />
              </div>

              {warning && (
                <div className="grid gap-1">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="acknowledged" required className="mt-0.5 size-4 accent-[var(--primary)]" />
                    <span>I have read the breeding check and want to record this mating.</span>
                  </label>
                  <FieldErrorText state={state} name="acknowledged" />
                </div>
              )}

              <PendingButton pending={pending} className="h-11 w-full sm:w-fit" pendingText="Saving…">
                Record mating
              </PendingButton>
            </>
          )}
        </>
      )}
    </form>
  );
}
