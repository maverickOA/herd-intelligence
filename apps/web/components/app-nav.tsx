"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartHandshake, Home, PawPrint, Settings, Users, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Only screens that work today appear here. Tasks joins the bar when that
 * milestone ships, so there are never dead buttons.
 */
function items(orgId: string) {
  const base = `/o/${orgId}`;
  return [
    { href: base, label: "Home", icon: Home, exact: true },
    { href: `${base}/herd`, label: "Herd", icon: PawPrint },
    { href: `${base}/breeding`, label: "Breeding", icon: HeartHandshake },
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
    <nav aria-label="Main" className="grid gap-0.5">
      {items(orgId).map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className={cn("size-[1.0625rem]", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
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
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-6">
        {items(orgId).map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {active && <span aria-hidden className="absolute top-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-foreground" />}
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
