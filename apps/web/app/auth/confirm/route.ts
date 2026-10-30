import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing route for links in Supabase emails (sign-up confirmation, password
 * reset). Supports both link styles:
 *  - token_hash + type: works when the email is opened on any device
 *    (requires the Supabase email templates to use {{ .TokenHash }}).
 *  - code: the default PKCE link; must be opened in the same browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();
  let errorMessage = "This link is missing information.";

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/account/password" : next, origin));
    errorMessage = error.message;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    errorMessage = error.message;
  }

  const url = new URL("/auth/error", origin);
  url.searchParams.set("reason", errorMessage.slice(0, 200));
  return NextResponse.redirect(url);
}
