"use server";

import { redirect } from "next/navigation";
import { friendlyError, safeNext, type ActionState } from "@/lib/action-state";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { email as emailSchema, fieldErrors, newPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first. Check your inbox for the link we sent.", values };
    }
    if (error.code === "invalid_credentials") return { error: "Email or password is incorrect.", values };
    return { error: friendlyError(error, "Could not sign in. Please try again."), values };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { fullName: String(formData.get("fullName") ?? ""), email: String(formData.get("email") ?? "") };
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "Choose a stronger password.", values };
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Too many sign-up emails sent just now. Please wait a few minutes and try again.", values };
    }
    return { error: friendlyError(error, "Could not create your account. Please try again."), values };
  }
  // If email confirmation is switched off in Supabase, the user is signed in straight away.
  if (data.session) redirect(next);
  return {
    ok: true,
    message: `We sent a confirmation link to ${parsed.data.email}. Open it on this phone or computer to finish signing up.`,
  };
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { fieldErrors: { email: ["Enter a valid email address"] } };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent("/account/password")}`,
  });
  // Same answer whether or not the account exists, so emails can't be probed.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password you haven't used before." };
    return { error: friendlyError(error, "Could not update your password. Please try again.") };
  }
  return { ok: true, message: "Password updated." };
}
