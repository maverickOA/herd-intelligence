import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * The mark: an H whose uprights curl outward into horns. One stroke weight,
 * one colour, so it holds up at favicon size and on a printed ear-tag sheet.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="64" height="64" rx="16" className="fill-brand" />
      <path
        d="M23 50V30c0-8-4-13-11-15M41 50V30c0-8 4-13 11-15M23 37h18"
        fill="none"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-brand-foreground"
      />
    </svg>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-semibold tracking-[-0.02em]", className)}>
      <BrandMark className="size-7" />
      <span>Herd Intelligence</span>
    </Link>
  );
}
