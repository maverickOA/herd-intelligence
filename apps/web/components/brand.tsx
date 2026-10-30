import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <path d="M32 50V26" strokeWidth="4" strokeLinecap="round" className="stroke-primary-foreground" fill="none" />
      <path d="M32 30c-9 0-15-6-15-15 9 0 15 6 15 15z" className="fill-primary-foreground/70" />
      <path d="M32 36c8 0 14-5 14-13-8 0-14 5-14 13z" className="fill-primary-foreground" />
    </svg>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <BrandMark />
      <span>Herd Intelligence</span>
    </Link>
  );
}
