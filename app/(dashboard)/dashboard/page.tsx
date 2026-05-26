import type { Metadata } from "next";
import Link from "next/link";

import { InactiveDashboardState } from "@/components/dashboard/InactiveDashboardState";
import { Button } from "@/components/ui/button";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import type { BrandAccessSummary } from "@/features/access/types";
import { logout } from "@/features/auth/actions";
import { requireUserProfile } from "@/features/auth/queries";
import { getBrandBuildProgress } from "@/features/dashboard/build-progress";
import { BrandBuildView } from "@/features/dashboard/components/BrandBuildView";
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

function QuickLinks({ canManage }: { canManage: boolean }) {
  if (!canManage) {
    return (
      <div className="flex flex-wrap gap-3">
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/files">Files</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="sm" variant="outline">
        <Link href="/dashboard/intake">Intake</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/dashboard/modules">Modules</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/dashboard/brain">Brain</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/dashboard/agents">Agents</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/dashboard/files">Files</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/dashboard/change-requests">Changes</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/dashboard/invitations">Invite</Link>
      </Button>
    </div>
  );
}

async function ActiveDashboard({
  accessSummary,
  email,
}: {
  accessSummary: BrandAccessSummary;
  email: string;
}) {
  const canManage = canInviteSpecialistRole(accessSummary.membershipRole);
  const brandId = accessSummary.brandId!;
  const brandName = accessSummary.brandName ?? "Brand";

  const buildProgress = await getBrandBuildProgress(brandId, brandName);

  return (
    <div className="space-y-6">
      <BrandBuildView progress={buildProgress} />

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{email}</span>
          {" · "}
          {accessSummary.brandName}
          {accessSummary.planName ? ` · ${accessSummary.planName}` : null}
        </div>
        <SignOutButton />
      </div>

      <QuickLinks canManage={canManage} />
    </div>
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
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Brand Brain
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">
              Build View
            </h1>
          </div>
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
