"use client";

import { useActionState, useState } from "react";
import { Field, FieldErrorText, FormMessage, SubmitButton } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialState, type ActionState } from "@/lib/action-state";
import { Constants, type Enums, type Tables } from "@/lib/database.types";
import { CONFIDENCE_LABEL, GONE_STATUSES, ORIGIN_LABEL, STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { registerAnimal, updateAnimal } from "./actions";

type Option = { id: string; name: string };
type ParentOption = { id: string; label: string; sex: Enums<"animal_sex"> };

export type AnimalFormProps = {
  orgId: string;
  currency: string;
  farms: Option[];
  pens: (Option & { farm_id: string })[];
  breeds: Option[];
  /** Farms this user may register animals on. */
  registerFarmIds: string[];
  /** Can set parents and purchase details. */
  canEditPedigree: boolean;
  parentOptions?: ParentOption[];
  animal?: Tables<"animals">;
  defaults?: { origin?: Enums<"animal_origin">; childOf?: string; childRole?: Enums<"parent_role">; childLabel?: string; farmId?: string };
};

const ORIGINS: { value: Enums<"animal_origin">; help: string }[] = [
  { value: "purchased", help: "You bought it, or will soon." },
  { value: "born_on_farm", help: "Kidded here." },
  { value: "received", help: "A gift, loan or transfer." },
  { value: "pedigree_only", help: "An ancestor from a seller's papers. Never on your farm." },
];

export function AnimalForm(props: AnimalFormProps) {
  const editing = !!props.animal;
  const [state, action] = useActionState<ActionState, FormData>(editing ? updateAnimal : registerAnimal, initialState);
  const a = props.animal;
  const val = (k: string, fallback = "") => state.values?.[k] ?? fallback;

  const fixedSex: Enums<"animal_sex"> | undefined =
    props.defaults?.childRole === "sire" ? "male" : props.defaults?.childRole === "dam" ? "female" : undefined;
  const [origin, setOrigin] = useState<Enums<"animal_origin">>(
    (val("origin") as Enums<"animal_origin">) || a?.origin || props.defaults?.origin || "purchased",
  );
  const recordOnly = origin === "pedigree_only";
  const farmChoices = editing ? props.farms : props.farms.filter((f) => props.registerFarmIds.includes(f.id));
  const [farmId, setFarmId] = useState(val("farmId", a?.farm_id ?? props.defaults?.farmId ?? farmChoices[0]?.id ?? ""));
  const pens = props.pens.filter((p) => p.farm_id === farmId);
  const showPurchase = !editing && props.canEditPedigree && (origin === "purchased" || origin === "received");
  const showParents = !editing && props.canEditPedigree && !props.defaults?.childOf && (props.parentOptions?.length ?? 0) > 0;
  const checked = (k: string, fallback: boolean) => (state.values ? state.values[k] === "on" : fallback);

  return (
    <form action={action} className="grid gap-6" noValidate>
      <input type="hidden" name="orgId" value={props.orgId} />
      {editing && <input type="hidden" name="animalId" value={a!.id} />}
      {editing && <input type="hidden" name="isRecordOnly" value={String(recordOnly)} />}
      {props.defaults?.childOf && <input type="hidden" name="childOf" value={props.defaults.childOf} />}
      {props.defaults?.childRole && <input type="hidden" name="childRole" value={props.defaults.childRole} />}
      <FormMessage state={state} />

      {!editing && !props.defaults?.childOf && (
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium">Where is this animal from?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ORIGINS.filter((o) => o.value !== "pedigree_only" || props.canEditPedigree).map((o) => (
              <label
                key={o.value}
                className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
              >
                <input
                  type="radio"
                  name="origin"
                  value={o.value}
                  checked={origin === o.value}
                  onChange={() => setOrigin(o.value)}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-medium">{ORIGIN_LABEL[o.value]}</span>
                  <span className="text-muted-foreground">{o.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {!editing && props.defaults?.childOf && (
        <>
          <input type="hidden" name="origin" value="pedigree_only" />
          <p className="rounded-lg bg-muted p-3 text-sm">
            Adding the <strong>{props.defaults.childRole}</strong> of <strong>{props.defaults.childLabel}</strong> from
            the seller&apos;s papers. It will be linked automatically.
          </p>
        </>
      )}

      <section className="grid gap-4">
        <h2 className="text-base font-semibold">Identity</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={recordOnly ? "Tag (if any)" : "Farm tag"} name="tag" defaultValue={a?.tag ?? ""} autoCapitalize="characters" placeholder={recordOnly ? "" : "e.g. GSF-001"} state={state} />
          <Field label="Name (optional)" name="name" defaultValue={a?.name ?? ""} state={state} />
          <Field label="Registration no. (optional)" name="registrationNumber" defaultValue={a?.registration_number ?? ""} state={state} />
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium">Sex</legend>
          {fixedSex ? (
            <>
              <input type="hidden" name="sex" value={fixedSex} />
              <p className="text-sm">{fixedSex === "male" ? "Buck (sire)" : "Doe (dam)"}</p>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:w-80">
              {Constants.public.Enums.animal_sex.map((s) => (
                <label key={s} className="flex h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent">
                  <input type="radio" name="sex" value={s} defaultChecked={(val("sex") || a?.sex) === s} className="size-4 accent-[var(--primary)]" />
                  {s === "male" ? "Buck" : "Doe"}
                </label>
              ))}
            </div>
          )}
          <FieldErrorText state={state} name="sex" />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="breedId">Breed</Label>
            <NativeSelect id="breedId" name="breedId" defaultValue={val("breedId", a?.breed_id ?? "")}>
              <option value="">Not recorded</option>
              {props.breeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Field label="Birth date" name="birthDate" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={a?.birth_date ?? ""} state={state} />
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" name="birthDateEstimated" defaultChecked={checked("birthDateEstimated", a?.birth_date_estimated ?? false)} className="size-4 accent-[var(--primary)]" />
              This date is an estimate
            </label>
          </div>
        </div>
      </section>

      {!recordOnly && (
        <section className="grid gap-4">
          <h2 className="text-base font-semibold">On the farm</h2>
          {farmChoices.length === 0 ? (
            <p className="text-sm text-destructive">You don&apos;t have a farm you can register animals on. Ask an owner to assign you one.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="farmId">Farm</Label>
                <NativeSelect id="farmId" name="farmId" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
                  {farmChoices.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldErrorText state={state} name="farmId" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="penId">Pen</Label>
                <NativeSelect id="penId" name="penId" key={farmId} defaultValue={val("penId", a?.farm_id === farmId ? (a?.pen_id ?? "") : "")}>
                  <option value="">No pen</option>
                  {pens.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldErrorText state={state} name="penId" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="status">Status</Label>
                <NativeSelect id="status" name="status" key={`status-${origin}`} defaultValue={val("status", a?.status ?? (origin === "born_on_farm" ? "growing" : "active"))}>
                  {Constants.public.Enums.animal_status.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                      {GONE_STATUSES.includes(s) ? " (left the herd)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          )}
        </section>
      )}

      {origin !== "born_on_farm" && (
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent">
          <input type="checkbox" name="isDeclaredFounder" defaultChecked={checked("isDeclaredFounder", a?.is_declared_founder ?? false)} className="mt-0.5 size-4 accent-[var(--primary)]" />
          <span>
            <span className="block font-medium">Treat as a founder</span>
            <span className="text-muted-foreground">
              Its unknown ancestors are assumed unrelated to the rest of your herd. Use for bought stock from a different
              source with no papers. Breeding checks will say when a result depends on this.
            </span>
          </span>
        </label>
      )}

      {showParents && (
        <section className="grid gap-4">
          <div>
            <h2 className="text-base font-semibold">Parents (if known)</h2>
            <p className="text-sm text-muted-foreground">
              Pick from animals already recorded. To add a sire or dam from a seller&apos;s papers, save first and use
              &ldquo;Add from papers&rdquo; on the profile.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <ParentSelect name="sireId" label="Sire" options={props.parentOptions!.filter((p) => p.sex === "male")} value={val("sireId")} />
            <ParentSelect name="damId" label="Dam" options={props.parentOptions!.filter((p) => p.sex === "female")} value={val("damId")} />
            <div className="grid gap-1.5">
              <Label htmlFor="parentConfidence">How do you know?</Label>
              <NativeSelect id="parentConfidence" name="parentConfidence" key={`conf-${origin}`} defaultValue={val("parentConfidence", origin === "born_on_farm" ? "observed" : "reported")}>
                {Constants.public.Enums.parent_confidence.map((c) => (
                  <option key={c} value={c}>
                    {CONFIDENCE_LABEL[c]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </section>
      )}
      {!editing && props.defaults?.childOf && <input type="hidden" name="parentConfidence" value="reported" />}

      {showPurchase && (
        <section className="grid gap-4">
          <div>
            <h2 className="text-base font-semibold">Purchase details (optional)</h2>
            <p className="text-sm text-muted-foreground">Only owners and farm managers can see these.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date bought" name="acquiredOn" type="date" max={new Date().toISOString().slice(0, 10)} state={state} />
            <Field label="Bought from" name="source" placeholder="Seller or market" state={state} />
            <Field label={`Price (${props.currency})`} name="price" inputMode="decimal" placeholder="e.g. 85000" state={state} />
          </div>
        </section>
      )}

      <section className="grid gap-4">
        <h2 className="text-base font-semibold">Description</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coat colour" name="color" defaultValue={a?.color ?? ""} state={state} />
          <Field label="Markings" name="markings" defaultValue={a?.markings ?? ""} placeholder="e.g. white blaze, notch in left ear" state={state} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={3} defaultValue={val("notes", a?.notes ?? "")} />
          <FieldErrorText state={state} name="notes" />
        </div>
      </section>

      <SubmitButton className={cn("h-12 w-full sm:w-fit sm:px-8")} pendingText="Saving…">
        {editing ? "Save changes" : props.defaults?.childOf ? `Add and link as ${props.defaults.childRole}` : "Register animal"}
      </SubmitButton>
    </form>
  );
}

function ParentSelect({ name, label, options, value }: { name: string; label: string; options: ParentOption[]; value: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <NativeSelect id={name} name={name} defaultValue={value}>
        <option value="">Unknown</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
