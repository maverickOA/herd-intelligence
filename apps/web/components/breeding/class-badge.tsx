import { AlertOctagon, AlertTriangle, CircleHelp, CircleCheck } from "lucide-react";
import type { Enums } from "@/lib/database.types";
import { CLASS_LABEL, CLASS_SHORT } from "@/lib/labels";
import { cn } from "@/lib/utils";

/*
 * Classification colours: restricted and high in the warning-red family,
 * insufficient as a neutral "unknown" (never green), elevated amber, low the
 * brand green. The icon and words carry the meaning, not colour alone.
 */
const TONE: Record<Enums<"breeding_class">, string> = {
  restricted: "border-destructive/40 bg-destructive/10 text-destructive",
  high: "border-destructive/30 bg-destructive/5 text-destructive",
  insufficient: "border-border bg-muted text-foreground",
  elevated: "border-warning/50 bg-warning/15 text-foreground",
  low: "border-primary/30 bg-primary/10 text-primary",
};

const ICON = {
  restricted: AlertOctagon,
  high: AlertTriangle,
  insufficient: CircleHelp,
  elevated: AlertTriangle,
  low: CircleCheck,
} as const;

export function ClassBadge({
  value,
  possible,
  long,
  className,
}: {
  value: Enums<"breeding_class">;
  possible?: boolean;
  long?: boolean;
  className?: string;
}) {
  const Icon = ICON[value];
  const text = long ? CLASS_LABEL[value] : CLASS_SHORT[value];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE[value], className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {possible ? `Possibly ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text}
    </span>
  );
}
