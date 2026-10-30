import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Link problem" };

export default async function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  const { reason } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:py-16">
      <Brand className="mb-8 self-center text-lg" />
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">That link didn&apos;t work</CardTitle>
          <CardDescription>
            Email links expire and can only be used once. If you opened it on a different phone or browser from the one
            you signed up on, try opening it there, or request a new one.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {typeof reason === "string" && <p className="text-xs text-muted-foreground">Details: {reason}</p>}
          <Button asChild className="h-11">
            <Link href="/login">Go to sign in</Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/forgot-password">Send a new password link</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
