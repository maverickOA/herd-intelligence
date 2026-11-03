import { Brand, BrandMark } from "@/components/brand";

const FACTS = [
  { k: "Pedigrees", v: "Three generations checked before every mating" },
  { k: "Breeding", v: "Inbreeding risk worked out from the records you have" },
  { k: "Team", v: "Owners, managers and workers each see what they need" },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Product panel: always dark, desktop only. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[oklch(0.145_0.004_286)] p-10 text-[oklch(0.967_0.001_286)] lg:flex">
        <div className="flex items-center gap-2.5 text-[0.9375rem] font-semibold tracking-[-0.02em]">
          <BrandMark className="size-7" />
          Herd Intelligence
        </div>

        <div className="max-w-md">
          <h2 className="text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.035em]">
            Know every animal, its ancestry and your farm.
          </h2>
          <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10">
            {FACTS.map((f) => (
              <div key={f.k} className="grid grid-cols-[6.5rem_1fr] gap-4 bg-[oklch(0.175_0.005_286)] px-4 py-3.5 text-sm">
                <dt className="text-white/50">{f.k}</dt>
                <dd className="text-white/90">{f.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-xs text-white/40">Built for goat farms in Nigeria. Works on any phone.</p>
      </aside>

      <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col px-5 py-8 sm:py-14 lg:justify-center lg:py-10">
        <Brand className="mb-10 text-[0.9375rem] lg:hidden" />
        <div className="[&_[data-slot=card-content]]:px-0 [&_[data-slot=card-header]]:px-0 [&_[data-slot=card-title]]:text-[1.5rem] [&_[data-slot=card-title]]:tracking-[-0.025em] [&_[data-slot=card]]:border-0 [&_[data-slot=card]]:bg-transparent [&_[data-slot=card]]:py-0">
          {children}
        </div>
        <p className="mt-auto pt-12 text-xs text-muted-foreground lg:hidden">
          Livestock records, pedigrees and breeding checks for your farm.
        </p>
      </main>
    </div>
  );
}
