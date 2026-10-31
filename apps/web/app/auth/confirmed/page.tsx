import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNext } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Email confirmed" };

/** Shown after a sign-up confirmation link works, whether or not this browser is signed in. */
export default async function EmailConfirmedPage({ searchParams }: PageProps<"/auth/confirmed">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const user = await getCurrentUser();
  const invited = next.startsWith("/invite/");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:py-16">
      <Brand className="mb-8 self-center text-lg" />
      <Card>
        <CardHeader>
          <CircleCheck className="mb-2 size-10 text-primary" aria-hidden />
          <CardTitle className="text-xl">Your email is confirmed</CardTitle>
          <CardDescription>
            {user
              ? `You're signed in as ${user.email ?? "your new account"}.`
              : "You opened the link in a different browser or app, so sign in here to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <Button asChild className="h-11 w-full">
              <Link href={next}>{invited ? "Continue to your invitation" : "Continue to set up your farm"}</Link>
            </Button>
          ) : (
            <Button asChild className="h-11 w-full">
              <Link href={`/login?confirmed=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
