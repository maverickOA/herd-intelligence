"use client";

import { useActionState, useState } from "react";
import { FieldErrorText, FormMessage, PendingButton, useNoResetSubmit } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialState } from "@/lib/action-state";
import { Constants } from "@/lib/database.types";
import { CONFIDENCE_LABEL } from "@/lib/labels";
import { birthAction } from "../actions";

type Option = { id: string; label: string };

export function KiddingForm({
  orgId,
  matingId,
  fixedDoe,
  does,
  matingSires,
  bucks,
  breeds,
  defaultBreedId,
  minDate,
  today,
}: {
  orgId: string;
  matingId?: string;
  /** Set when recording against a mating: the doe can't change. */
  fixedDoe?: Option;
  does: Option[];
  /** Bucks recorded for the mating (empty without a mating). */
  matingSires: Option[];
  /** Any buck, for kiddings without a mating record. */
  bucks: Option[];
  breeds: Option[];
  defaultBreedId?: string;
  minDate?: string;
  today: string;
}) {
  const [state, action] = useActionState(birthAction, initialState);
  const { onSubmit, pending } = useNoResetSubmit(action);
  const v = state.values ?? {};
  const [count, setCount] = useState(Number(v.kidCount) || 1);
  const [alive, setAlive] = useState<Record<number, boolean>>({});
  const fromMating = !!matingId;

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <input type="hidden" name="orgId" value={orgId} />
      {matingId && <input type="hidden" name="matingId" value={matingId} />}
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        {fixedDoe ? (
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Doe</span>
            <p className="flex h-11 items-center rounded-md border bg-muted px-3 text-sm">{fixedDoe.label}</p>
            <input type="hidden" name="doeId" value={fixedDoe.id} />
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="doeId">Doe</Label>
            <NativeSelect id="doeId" name="doeId" defaultValue={v.doeId ?? ""} key={`doe-${v.doeId}`} required>
              <option value="" disabled>
                Choose the doe
              </option>
              {does.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
            <FieldErrorText state={state} name="doeId" />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="bornOn">Kidded on</Label>
          <Input id="bornOn" name="bornOn" type="date" min={minDate} max={today} defaultValue={v.bornOn || today} required className="h-11" />
          <FieldErrorText state={state} name="bornOn" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="sireId">Sire</Label>
          {fromMating && matingSires.length === 1 ? (
            <>
              <p className="flex h-11 items-center rounded-md border bg-muted px-3 text-sm">{matingSires[0]!.label} (from the mating)</p>
            </>
          ) : (
            <NativeSelect id="sireId" name="sireId" defaultValue={v.sireId ?? ""} key={`sire-${v.sireId}`}>
              <option value="">{fromMating ? `Not sure: record all ${matingSires.length} as possible sires` : "Unknown"}</option>
              {(fromMating ? matingSires : bucks).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sireConfidence">How the sire is known</Label>
          <NativeSelect id="sireConfidence" name="sireConfidence" defaultValue={v.sireConfidence || "observed"} key={`sc-${v.sireConfidence}`}>
            {Constants.public.Enums.parent_confidence.map((c) => (
              <option key={c} value={c}>
                {CONFIDENCE_LABEL[c]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="kidCount">Number of kids (including stillborn)</Label>
          <NativeSelect id="kidCount" name="kidCount" value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 (single)" : n === 2 ? "2 (twins)" : n === 3 ? "3 (triplets)" : n === 4 ? "4 (quadruplets)" : n}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="breedId">Kids&apos; breed</Label>
          <NativeSelect id="breedId" name="breedId" defaultValue={v.breedId ?? defaultBreedId ?? ""} key={`br-${v.breedId}`}>
            <option value="">Not recorded</option>
            {breeds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">Kids</legend>
        {Array.from({ length: count }, (_, i) => {
          const isAlive = alive[i] ?? (v[`kid${i}.alive`] ? v[`kid${i}.alive`] === "alive" : true);
          return (
            <div key={i} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[8rem_7rem_1fr_1fr_6rem]">
              <div className="grid gap-1.5">
                <Label htmlFor={`kid${i}.alive`}>Kid {i + 1}</Label>
                <NativeSelect
                  id={`kid${i}.alive`}
                  name={`kid${i}.alive`}
                  value={isAlive ? "alive" : "stillborn"}
                  onChange={(e) => setAlive((a) => ({ ...a, [i]: e.target.value === "alive" }))}
                >
                  <option value="alive">Born alive</option>
                  <option value="stillborn">Stillborn</option>
                </NativeSelect>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`kid${i}.sex`}>Sex</Label>
                <NativeSelect id={`kid${i}.sex`} name={`kid${i}.sex`} defaultValue={v[`kid${i}.sex`] ?? ""} key={`sex-${i}-${v[`kid${i}.sex`]}`} required={isAlive}>
                  <option value="">{isAlive ? "Choose" : "Unknown"}</option>
                  <option value="male">Buck</option>
                  <option value="female">Doe</option>
                </NativeSelect>
                <FieldErrorText state={state} name={`kid${i}.sex`} />
              </div>
              {isAlive ? (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`kid${i}.tag`}>Tag</Label>
                    <Input id={`kid${i}.tag`} name={`kid${i}.tag`} defaultValue={v[`kid${i}.tag`] ?? ""} className="h-11" autoComplete="off" />
                    <FieldErrorText state={state} name={`kid${i}.tag`} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`kid${i}.name`}>Name (optional)</Label>
                    <Input id={`kid${i}.name`} name={`kid${i}.name`} defaultValue={v[`kid${i}.name`] ?? ""} className="h-11" autoComplete="off" />
                  </div>
                </>
              ) : (
                <p className="self-end pb-3 text-sm text-muted-foreground sm:col-span-2">Counted in the litter; no animal record is created.</p>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor={`kid${i}.weightKg`}>Weight kg</Label>
                <Input id={`kid${i}.weightKg`} name={`kid${i}.weightKg`} inputMode="decimal" defaultValue={v[`kid${i}.weightKg`] ?? ""} className="h-11" placeholder="2.8" />
                <FieldErrorText state={state} name={`kid${i}.weightKg`} />
              </div>
            </div>
          );
        })}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="assisted" defaultChecked={v.assisted === "on"} className="size-4 accent-[var(--primary)]" />
        The doe needed help kidding
      </label>
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={v.notes ?? ""} />
      </div>

      <PendingButton pending={pending} className="h-11 w-full sm:w-fit" pendingText="Saving…">
        Record kidding
      </PendingButton>
    </form>
  );
}
