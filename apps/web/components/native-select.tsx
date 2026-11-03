import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A styled native <select>: best on phones, works in plain HTML forms. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-transparent bg-muted pr-9 pl-3 text-sm outline-none transition-[color,background-color,box-shadow,border-color] hover:bg-accent focus-visible:border-ring/60 focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/15 disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}
