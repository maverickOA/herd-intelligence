"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { initialState } from "@/lib/action-state";
import { resendConfirmation } from "@/app/(auth)/actions";

/** "Send the confirmation link again", with the email filled in when we know it. */
export function ResendConfirmation({ email, next = "/", label = "Send the confirmation link again" }: { email?: string; next?: string; label?: string }) {
  const [state, action] = useActionState(resendConfirmation, initialState);
  return (
    <form action={action} className="grid gap-3" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required state={state} />
      )}
      {!state.ok && (
        <SubmitButton variant="outline" className="h-11 w-full" pendingText="Sending…">
          {label}
        </SubmitButton>
      )}
    </form>
  );
}
