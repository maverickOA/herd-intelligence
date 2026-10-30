import Link from "next/link";
import type { PedigreeNode } from "@/lib/herd";
import { CONFIDENCE_SHORT } from "@/lib/labels";
import { cn } from "@/lib/utils";

/*
 * Three generations back as columns: parents, grandparents, great-grandparents.
 * Node i's sire is at 2i+1 and dam at 2i+2 (breadth-first), so column g holds
 * indexes 2^g - 1 ... 2^(g+1) - 2, already in top-to-bottom order.
 */
export function PedigreeTree({ orgId, nodes, generations = 3 }: { orgId: string; nodes: PedigreeNode[]; generations?: number }) {
  const cols = Array.from({ length: generations }, (_, g) => {
    const start = 2 ** (g + 1) - 1;
    return nodes.slice(start, start + 2 ** (g + 1)).map((n, i) => ({ n, idx: start + i }));
  });
  const titles = ["Parents", "Grandparents", "Great-grandparents"];

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="grid min-w-[40rem] grid-cols-3 gap-3 p-3">
        {cols.map((col, g) => (
          <div key={g} className="flex flex-col">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{titles[g]}</p>
            <ol className="flex flex-1 flex-col justify-around gap-1.5">
              {col.map(({ n, idx }) => {
                const role = idx % 2 === 1 ? "Sire" : "Dam";
                const child = nodes[Math.floor((idx - 1) / 2)];
                const unknownBecauseFounder = !n.id && child?.isFounder;
                // A branch above an unknown animal can't exist: keep the space, show nothing.
                const branchMissing = !n.id && !child?.id;
                return (
                  <li
                    key={idx}
                    aria-hidden={branchMissing || undefined}
                    className={cn(
                      "min-w-0 rounded-md border px-2.5 py-1.5 text-sm",
                      n.id ? "bg-background" : "border-dashed text-muted-foreground",
                      g === 2 && "py-1 text-xs",
                      branchMissing && "invisible",
                    )}
                  >
                    <span className="block text-[0.7rem] text-muted-foreground">{role}</span>
                    {n.id ? (
                      n.hidden ? (
                        <span className="text-muted-foreground">Not visible to you</span>
                      ) : (
                        <Link href={`/o/${orgId}/herd/${n.id}`} className="block truncate font-medium text-primary underline-offset-4 hover:underline">
                          {n.label}
                        </Link>
                      )
                    ) : (
                      <span>{unknownBecauseFounder ? "Founder line" : "Unknown"}</span>
                    )}
                    {n.confidence && n.confidence !== "observed" && n.confidence !== "dna" && (
                      <span className="block text-[0.7rem] text-muted-foreground">{CONFIDENCE_SHORT[n.confidence]}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Known ancestors out of the 14 slots in three generations. */
export function ancestorCount(nodes: PedigreeNode[]) {
  return nodes.slice(1).filter((n) => n.id).length;
}
