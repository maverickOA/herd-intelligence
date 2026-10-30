import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyProfile, getOrgContext, isOwner } from "@/lib/data";
import { OrganizationForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/o/[orgId]/settings">) {
  const { orgId } = await params;
  const [ctx, me] = await Promise.all([getOrgContext(orgId), getMyProfile()]);
  const owner = isOwner(ctx);

  return (
    <>
      <PageHeader title="Settings" />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your details</CardTitle>
            <CardDescription>Shown to people in your organizations.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm orgId={orgId} fullName={me.fullName ?? ""} phone={me.phone ?? ""} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
            <CardDescription>
              {owner ? "Regional settings used for dates and money." : "Only owners can change these."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {owner ? (
              <OrganizationForm org={ctx.org} />
            ) : (
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">Name</dt>
                <dd>{ctx.org.name}</dd>
                <dt className="text-muted-foreground">Country</dt>
                <dd>{ctx.org.country_code}</dd>
                <dt className="text-muted-foreground">Currency</dt>
                <dd>{ctx.org.currency_code}</dd>
                <dt className="text-muted-foreground">Time zone</dt>
                <dd>{ctx.org.timezone}</dd>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Signed in as {me.email}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-11">
              <Link href="/account/password">Change password</Link>
            </Button>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" className="h-11">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
