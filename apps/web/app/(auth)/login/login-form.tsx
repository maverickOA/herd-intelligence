"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initialState } from "@/lib/action-state";
import { signIn } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, initialState);
  const qs = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back. Use the email you signed up with.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4" noValidate>
          <input type="hidden" name="next" value={next} />
          <FormMessage state={state} />
          <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required state={state} />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required state={state} />
          <SubmitButton className="h-11 w-full" pendingText="Signing in…">
            Sign in
          </SubmitButton>
        </form>
        <div className="mt-6 flex flex-col gap-2 text-center text-sm">
          <Link href={`/forgot-password${qs}`} className="text-muted-foreground underline-offset-4 hover:underline">
            Forgot your password?
          </Link>
          <p className="text-muted-foreground">
            New here?{" "}
            <Link href={`/signup${qs}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
