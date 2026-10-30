"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initialState } from "@/lib/action-state";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>We&apos;ll email you a link to choose a new password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4" noValidate>
          <FormMessage state={state} />
          {!state.ok && (
            <>
              <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required state={state} />
              <SubmitButton className="h-11 w-full" pendingText="Sending…">
                Send reset link
              </SubmitButton>
            </>
          )}
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
