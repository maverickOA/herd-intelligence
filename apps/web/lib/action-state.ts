import type { FieldErrors } from "@/lib/validation";

/** Shape returned by every Server Action used with useActionState. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: FieldErrors;
  /** Echo of submitted values so a form can be refilled after an error. */
  values?: Record<string, string>;
  /** Extra data for the form, e.g. a generated invitation link. */
  data?: Record<string, string>;
};

export const initialState: ActionState = {};

type DbError = { code?: string; message?: string } | null | undefined;

/**
 * Turn a database or auth error into a message a farmer can act on.
 * Messages we raise ourselves (in RPCs and triggers) are already plain English
 * and pass through; raw Postgres wording never reaches the screen.
 */
export function friendlyError(error: DbError, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const msg = error.message ?? "";
  if (/row-level security|permission denied/i.test(msg)) return "You don't have permission to do that.";
  if (error.code === "23505" || /duplicate key/i.test(msg)) {
    if (/pens_farm_name/i.test(msg)) return "A pen with that name already exists on this farm.";
    if (/already a member/i.test(msg)) return msg;
    return "That already exists.";
  }
  if (/violates|syntax|invalid input|relation|column/i.test(msg)) return fallback;
  if (msg && ["22023", "42501", "23514", "P0001", "P0002"].includes(error.code ?? "")) return msg;
  return fallback;
}

/** Only allow same-site relative redirects (blocks //evil.com and absolute URLs). */
export function safeNext(next: FormDataEntryValue | string | null | undefined, fallback = "/"): string {
  const value = typeof next === "string" ? next : "";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
