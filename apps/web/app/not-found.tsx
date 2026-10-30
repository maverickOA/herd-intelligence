import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

/*
 * Shown for unknown pages and for organizations you are not a member of.
 * Deliberately the same answer in both cases, so the page reveals nothing
 * about whether an organization exists.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:py-16">
      <Brand className="mb-8 self-center text-lg" />
      <div className="text-center">
        <h1 className="text-xl font-semibold">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page doesn&apos;t exist, or you don&apos;t have access to it. If someone shared it with you, ask them to
          check your role and farm access.
        </p>
        <Button asChild className="mt-6 h-11">
          <Link href="/">Go to your farm</Link>
        </Button>
      </div>
    </main>
  );
}
