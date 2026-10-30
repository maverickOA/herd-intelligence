"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { initialState } from "@/lib/action-state";
import { acceptInvitation } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitation, initialState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton className="h-11 w-full" pendingText="Joining…">
        Accept invitation
      </SubmitButton>
    </form>
  );
}
