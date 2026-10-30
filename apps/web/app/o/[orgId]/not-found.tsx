import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page doesn&apos;t exist, or you don&apos;t have access to it. If someone shared it with you, ask them to
        check your role and farm access.
      </p>
      <Button asChild className="mt-6 h-11">
        <Link href="/">Go to your farm</Link>
      </Button>
    </div>
  );
}
