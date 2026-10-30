"use client";

import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/forms";
import type { Tables } from "@/lib/database.types";
import { saveAcquisition } from "../actions";

export function AcquisitionForm({
  orgId,
  animalId,
  currency,
  acquisition,
}: {
  orgId: string;
  animalId: string;
  currency: string;
  acquisition: Tables<"animal_acquisitions"> | null;
}) {
  return (
    <ActionForm action={saveAcquisition} hidden={{ orgId, animalId }} className="grid gap-4">
      {(state) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date bought" name="acquiredOn" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={acquisition?.acquired_on ?? ""} state={state} />
            <Field label="Bought from" name="source" defaultValue={acquisition?.source ?? ""} placeholder="Seller or market" state={state} />
            <Field
              label={`Price (${acquisition?.currency_code ?? currency})`}
              name="price"
              inputMode="decimal"
              defaultValue={acquisition?.price != null ? String(acquisition.price) : ""}
              state={state}
            />
          </div>
          <Field label="Notes" name="notes" defaultValue={acquisition?.notes ?? ""} state={state} />
          <SubmitButton variant="secondary" className="h-11 sm:w-fit" pendingText="Saving…">
            Save purchase details
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
