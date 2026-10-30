"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PawPrint, Settings, Users, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Only screens that work today appear here. Breeding and Tasks join the bar
 * as those milestones ship, so there are never dead buttons.
 */
function items(orgId: string) {
  const base = `/o/${orgId}`;
  return [
    { href: base, label: "Home", icon: Home, exact: true },
    { href: `${base}/herd`, label: "Herd", icon: PawPrint },
    { href: `${base}/farms`, label: "Farms", icon: Warehouse },
    { href: `${base}/team`, label: "Team", icon: Users },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ];
}

function useActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
}

export function SidebarNav({ orgId }: { orgId: string }) {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="grid gap-1">
      {items(orgId).map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ orgId }: { orgId: string }) {
  const isActive = useActive();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items(orgId).map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.5]")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
