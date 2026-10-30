import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:py-16">
      <Brand className="mb-8 self-center text-lg" />
      {children}
      <p className="mt-auto pt-10 text-center text-xs text-muted-foreground">
        Livestock records, pedigrees and breeding checks for your farm.
      </p>
    </main>
  );
}
