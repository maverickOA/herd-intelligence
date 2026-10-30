"use client";

import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingText,
  className,
  variant,
  size,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={className} variant={variant} size={size}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle aria-hidden />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.ok && state.message) {
    return (
      <Alert role="status">
        <CheckCircle2 aria-hidden className="text-primary" />
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

/** Labelled input with its validation message, sized for thumbs (h-11). */
export function Field({
  label,
  name,
  state,
  hint,
  className,
  defaultValue,
  ...input
}: {
  label: string;
  name: string;
  state?: ActionState;
  hint?: string;
} & React.ComponentProps<typeof Input>) {
  const errors = state?.fieldErrors?.[name];
  const id = input.id ?? `field-${name}`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        className="h-11"
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? `${id}-error` : hint ? `${id}-hint` : undefined}
        defaultValue={state?.values?.[name] ?? defaultValue}
        {...input}
      />
      {errors ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errors[0]}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FieldErrorText({ state, name }: { state: ActionState; name: string }) {
  const errors = state.fieldErrors?.[name];
  if (!errors) return null;
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}
