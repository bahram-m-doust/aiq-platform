import type { Metadata } from "next";
import Link from "next/link";

import { InactiveDashboardState } from "@/components/dashboard/InactiveDashboardState";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import type { BrandAccessSummary } from "@/features/access/types";
import { logout } from "@/features/auth/actions";
import { requireUserProfile } from "@/features/auth/queries";
import { canInviteSpecialistRole } from "@/features/invitations/schema";

export const metadata: Metadata = {
  title: "Dashboard | Bextudio Platform",
};

export const dynamic = "force-dynamic";

function SignOutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}

function ActiveDashboard({
  accessSummary,
  email,
}: {
  accessSummary: BrandAccessSummary;
  email: string;
}) {
  const canManageWorkspace = canInviteSpecialistRole(
    accessSummary.membershipRole,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>
          Signed in as {email}. Brand workspace access is active.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Brand</dt>
            <dd className="font-medium">{accessSummary.brandName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium">{accessSummary.membershipRole}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-medium">{accessSummary.planName ?? "Active"}</dd>
          </div>
        </dl>
        {canManageWorkspace ? (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Your active workspace is ready for Strategic Intake, reviewed
              corrections, and Brand Specialist collaboration.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard/intake">Open Strategic Intake</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/modules">Modules</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/brain">Brand Brain</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/agents">Agents</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/files">Files</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/change-requests">Change Requests</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/invitations">Invite Specialist</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Your Brand Specialist workspace is active. You can upload
              supporting files and download files allowed for the brand team.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard/files">Files</Link>
              </Button>
            </div>
          </>
        )}
        <SignOutButton />
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { user, profile } = await requireUserProfile("/dashboard");
  const accessSummary = await getBrandAccessSummaryForProfile(profile.id);
  const email = user.email ?? profile.email;
  const params = await searchParams;
  const initialRawKey =
    typeof params.key === "string" ? params.key.trim() : "";

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Identity verified
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Dashboard
          </h1>
        </div>
        {accessSummary.status === "ACTIVE_ACCESS" ? (
          <ActiveDashboard accessSummary={accessSummary} email={email} />
        ) : (
          <InactiveDashboardState
            email={email}
            initialRawKey={initialRawKey}
            signOutAction={<SignOutButton />}
          />
        )}
      </section>
    </main>
  );
}
