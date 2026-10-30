import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Paths anyone can open without signing in. */
const PUBLIC_PREFIXES = ["/login", "/signup", "/forgot-password", "/auth", "/invite"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session on every request and sends signed-out
 * visitors to the sign-in page. Data protection itself is enforced by Row
 * Level Security in the database, not here.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): getClaims
  // refreshes the token, and anything in between can sign users out at random.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  const { pathname, search } = request.nextUrl;
  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    // Keep any refreshed or cleared auth cookies on the redirect.
    for (const cookie of supabaseResponse.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return supabaseResponse;
}
