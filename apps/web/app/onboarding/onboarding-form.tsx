"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initialState } from "@/lib/action-state";
import { createOrganization } from "./actions";

export function OnboardingForm({ hasOrgs }: { hasOrgs: boolean }) {
  const [state, action] = useActionState(createOrganization, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{hasOrgs ? "Add another organization" : "Set up your farm"}</CardTitle>
        <CardDescription>
          Your organization is your farm business. You&apos;ll be its owner, and you can add more farms and invite your
          team next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4" noValidate>
          <FormMessage state={state} />
          <Field
            label="Organization name"
            name="name"
            placeholder="e.g. Green Summit Farms"
            autoComplete="organization"
            required
            state={state}
          />
          <Field
            label="First farm or location"
            name="firstFarmName"
            placeholder="e.g. Ilorin main farm"
            required
            hint="You can add more farms later."
            state={state}
          />
          <p className="text-sm text-muted-foreground">
            Defaults: Nigeria, naira (NGN), Lagos time, metric units. You can change these in settings.
          </p>
          <SubmitButton className="h-11 w-full" pendingText="Setting up…">
            Create organization
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
