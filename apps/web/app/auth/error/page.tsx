import type { Metadata } from "next";
import Link from "next/link";
import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNext } from "@/lib/action-state";

export const metadata: Metadata = { title: "Link problem" };

export default async function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  const sp = await searchParams;
  const kind = typeof sp.kind === "string" ? sp.kind : "invalid";
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const reset = kind === "reset";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:py-16">
      <Brand className="mb-8 self-center text-lg" />
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{kind === "expired" ? "That link has expired or was already used" : "That link didn't work"}</CardTitle>
          <CardDescription>
            {reset
              ? "Password reset links can be used once and expire after an hour. Request a new one below."
              : "If you already confirmed your email, just sign in. If not, send yourself a new confirmation link."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button asChild className="h-11">
            <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>Go to sign in</Link>
          </Button>
          {reset ? (
            <Button asChild variant="outline" className="h-11">
              <Link href="/forgot-password">Send a new password link</Link>
            </Button>
          ) : (
            <div className="grid gap-2 border-t pt-4">
              <p className="text-sm font-medium">Need a new confirmation link?</p>
              <ResendConfirmation next={next} label="Send a new link" />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
