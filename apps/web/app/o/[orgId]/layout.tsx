import { BottomNav, SidebarNav } from "@/components/app-nav";
import { BrandMark } from "@/components/brand";
import { OrgSwitcher, UserMenu } from "@/components/org-menus";
import { getMyOrganizations, getMyProfile, getOrgContext } from "@/lib/data";

export default async function OrgLayout({ children, params }: LayoutProps<"/o/[orgId]">) {
  const { orgId } = await params;
  const [ctx, orgs, me] = await Promise.all([getOrgContext(orgId), getMyOrganizations(), getMyProfile()]);
  const current = { id: ctx.org.id, name: ctx.org.name, role: ctx.role };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r bg-sidebar px-3 pt-4 pb-3 md:flex">
        <div className="flex items-center gap-2 px-1.5">
          <BrandMark className="size-6" />
          <span className="text-[0.9375rem] font-semibold tracking-[-0.02em]">Herd Intelligence</span>
        </div>
        <OrgSwitcher current={current} orgs={orgs} />
        <div className="grid gap-1.5">
          <p className="eyebrow px-2.5">Workspace</p>
          <SidebarNav orgId={orgId} />
        </div>
        <div className="mt-auto flex items-center gap-2 rounded-lg px-1 pt-3">
          <UserMenu orgId={orgId} name={me.fullName} email={me.email} />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{me.fullName ?? "Your account"}</p>
            <p className="truncate text-xs text-muted-foreground">{me.email}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/90 px-3 py-2 backdrop-blur-xl md:hidden">
          <BrandMark className="size-7" />
          <div className="min-w-0 flex-1">
            <OrgSwitcher current={current} orgs={orgs} />
          </div>
          <UserMenu orgId={orgId} name={me.fullName} email={me.email} />
        </header>

        <main className="mx-auto w-full max-w-[56rem] flex-1 px-4 pt-6 pb-28 md:px-10 md:pt-10 md:pb-14">{children}</main>
      </div>

      <BottomNav orgId={orgId} />
    </div>
  );
}
