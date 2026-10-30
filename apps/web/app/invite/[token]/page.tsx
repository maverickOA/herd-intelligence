import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Join a farm" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const user = await getCurrentUser();
  const next = `/invite/${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:py-16">
      <Brand className="mb-8 self-center text-lg" />
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">You&apos;ve been invited to a farm</CardTitle>
          <CardDescription>
            {user
              ? `You're signed in as ${user.email}. The invitation must have been sent to this email address.`
              : "Sign in or create an account with the email address the invitation was sent to."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {user ? (
            <>
              <AcceptForm token={token} />
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="ghost" className="h-11 w-full">
                  Use a different account
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild className="h-11">
                <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
              </Button>
              <Button asChild variant="outline" className="h-11">
                <Link href={`/login?next=${encodeURIComponent(next)}`}>I already have an account</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
