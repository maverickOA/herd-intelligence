import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing route for links in Supabase emails (sign-up confirmation, password
 * reset). Supports both link styles:
 *  - token_hash + type: works when the email is opened on any device
 *    (requires the Supabase email templates to use {{ .TokenHash }}).
 *  - code: the default PKCE link. Supabase confirms the email before it sends
 *    the browser here with a code, so if the code can't be exchanged (link
 *    opened in a different browser) the email is still confirmed and the
 *    person just needs to sign in.
 * A confirmed sign-up always ends on /auth/confirmed, which says so plainly.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const isReset = type === "recovery" || next.startsWith("/account/password");

  const confirmed = () => {
    const url = new URL("/auth/confirmed", origin);
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };
  const failed = (kind: string, detail?: string) => {
    const url = new URL("/auth/error", origin);
    url.searchParams.set("kind", isReset ? "reset" : kind);
    if (next !== "/") url.searchParams.set("next", next);
    if (detail) url.searchParams.set("reason", detail.slice(0, 200));
    return NextResponse.redirect(url);
  };

  // Supabase sends errors back as query parameters (e.g. an expired or reused link).
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");
  if (errorCode) return failed(/expired|access_denied/.test(errorCode) ? "expired" : "invalid", searchParams.get("error_description") ?? errorCode);

  const supabase = await createClient();
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return isReset ? NextResponse.redirect(new URL("/account/password", origin)) : confirmed();
    return failed(/expired|invalid/i.test(error.message) ? "expired" : "invalid", error.message);
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(isReset ? "/account/password" : `/auth/confirmed${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`, origin));
    // Opened in another browser: the email is confirmed, but there's no session here.
    if (!isReset) return confirmed();
    return failed("reset", error.message);
  }
  return failed("invalid", "This link is missing information.");
}
