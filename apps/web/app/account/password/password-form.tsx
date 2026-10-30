"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initialState } from "@/lib/action-state";
import { updatePassword } from "@/app/(auth)/actions";

export function PasswordForm({ email }: { email: string | null }) {
  const [state, action] = useActionState(updatePassword, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        {email && <CardDescription>For {email}</CardDescription>}
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4" noValidate>
          <FormMessage state={state} />
          {!state.ok && (
            <>
              <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters." state={state} />
              <Field label="Repeat password" name="confirm" type="password" autoComplete="new-password" required state={state} />
              <SubmitButton className="h-11 w-full" pendingText="Saving…">
                Save password
              </SubmitButton>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
