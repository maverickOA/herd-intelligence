import { BottomNav, SidebarNav } from "@/components/app-nav";
import { BrandMark } from "@/components/brand";
import { OrgSwitcher, UserMenu } from "@/components/org-menus";
import { getMyOrganizations, getMyProfile, getOrgContext } from "@/lib/data";

export default async function OrgLayout({ children, params }: LayoutProps<"/o/[orgId]">) {
  const { orgId } = await params;
  const [ctx, orgs, me] = await Promise.all([getOrgContext(orgId), getMyOrganizations(), getMyProfile()]);
  const current = { id: ctx.org.id, name: ctx.org.name, role: ctx.role };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-r bg-sidebar p-3 md:flex">
        <div className="flex items-center gap-2 px-2 pt-1">
          <BrandMark className="size-7" />
          <span className="text-sm font-semibold tracking-tight">Herd Intelligence</span>
        </div>
        <OrgSwitcher current={current} orgs={orgs} />
        <SidebarNav orgId={orgId} />
        <div className="mt-auto flex items-center gap-2 border-t pt-3">
          <UserMenu orgId={orgId} name={me.fullName} email={me.email} />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{me.fullName ?? "Your account"}</p>
            <p className="truncate text-xs text-muted-foreground">{me.email}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur md:hidden">
          <BrandMark className="size-7" />
          <div className="min-w-0 flex-1">
            <OrgSwitcher current={current} orgs={orgs} />
          </div>
          <UserMenu orgId={orgId} name={me.fullName} email={me.email} />
        </header>

        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-5 pb-24 md:px-8 md:pt-8 md:pb-10">{children}</main>
      </div>

      <BottomNav orgId={orgId} />
    </div>
  );
}
