import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function PasswordPage() {
  const user = await requireUser("/account/password");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:py-16">
      <Brand className="mb-8 self-center text-lg" />
      <PasswordForm email={user.email} />
      <p className="mt-6 text-center text-sm">
        <Link href="/" className="text-muted-foreground underline-offset-4 hover:underline">
          Continue to your farm
        </Link>
      </p>
    </main>
  );
}
