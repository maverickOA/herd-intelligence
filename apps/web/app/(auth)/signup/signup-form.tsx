"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initialState } from "@/lib/action-state";
import { signUp } from "../actions";

export function SignupForm({ next, invited }: { next: string; invited: boolean }) {
  const [state, action] = useActionState(signUp, initialState);
  const qs = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  if (state.ok) {
    return (
      <Card>
        <CardHeader>
          <MailCheck className="mb-2 size-8 text-primary" aria-hidden />
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Can&apos;t find it? Look in spam or promotions. The link expires after 24 hours.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          {invited
            ? "Use the email address your invitation was sent to."
            : "Start keeping records for your farm. You can invite your team afterwards."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4" noValidate>
          <input type="hidden" name="next" value={next} />
          <FormMessage state={state} />
          <Field label="Full name" name="fullName" autoComplete="name" required state={state} />
          <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required state={state} />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
            state={state}
          />
          <SubmitButton className="h-11 w-full" pendingText="Creating account…">
            Create account
          </SubmitButton>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={`/login${qs}`} className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
