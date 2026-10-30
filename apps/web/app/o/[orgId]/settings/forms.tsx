"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { initialState } from "@/lib/action-state";
import type { Tables } from "@/lib/database.types";
import { updateOrganization, updateProfile } from "../actions";

const TIMEZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Abidjan",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Europe/London",
  "UTC",
];

const CURRENCIES = [
  ["NGN", "Nigerian naira (NGN)"],
  ["GHS", "Ghanaian cedi (GHS)"],
  ["XOF", "West African CFA franc (XOF)"],
  ["KES", "Kenyan shilling (KES)"],
  ["ZAR", "South African rand (ZAR)"],
  ["USD", "US dollar (USD)"],
  ["GBP", "British pound (GBP)"],
  ["EUR", "Euro (EUR)"],
] as const;

export function ProfileForm({ orgId, fullName, phone }: { orgId: string; fullName: string; phone: string }) {
  const [state, action] = useActionState(updateProfile, initialState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="orgId" value={orgId} />
      <FormMessage state={state} />
      <Field label="Full name" name="fullName" defaultValue={fullName} autoComplete="name" required state={state} />
      <Field
        label="Phone (optional)"
        name="phone"
        type="tel"
        inputMode="tel"
        defaultValue={phone}
        autoComplete="tel"
        placeholder="e.g. 0801 234 5678"
        hint="Lets teammates call you from the team list."
        state={state}
      />
      <SubmitButton className="h-11 sm:w-fit" pendingText="Saving…">
        Save my details
      </SubmitButton>
    </form>
  );
}

export function OrganizationForm({ org }: { org: Tables<"organizations"> }) {
  const [state, action] = useActionState(updateOrganization, initialState);
  const tzOptions = TIMEZONES.includes(org.timezone) ? TIMEZONES : [org.timezone, ...TIMEZONES];
  const currencyKnown = CURRENCIES.some(([c]) => c === org.currency_code);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="orgId" value={org.id} />
      <FormMessage state={state} />
      <Field label="Organization name" name="name" defaultValue={org.name} required state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Country code" name="countryCode" defaultValue={org.country_code} maxLength={2} hint="e.g. NG" state={state} />
        <div className="grid gap-1.5">
          <Label htmlFor="currencyCode">Currency</Label>
          <NativeSelect id="currencyCode" name="currencyCode" defaultValue={state.values?.currencyCode ?? org.currency_code}>
            {!currencyKnown && <option value={org.currency_code}>{org.currency_code}</option>}
            {CURRENCIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="timezone">Time zone</Label>
          <NativeSelect id="timezone" name="timezone" defaultValue={state.values?.timezone ?? org.timezone}>
            {tzOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Units are metric (kg, cm).</p>
      <SubmitButton className="h-11 sm:w-fit" pendingText="Saving…">
        Save organization
      </SubmitButton>
    </form>
  );
}
