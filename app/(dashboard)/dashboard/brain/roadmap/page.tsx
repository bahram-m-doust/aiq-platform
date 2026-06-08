import type { Metadata } from "next";

import { InactiveDashboardState } from "@/components/dashboard/InactiveDashboardState";
import { Button } from "@/components/ui/button";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { logout } from "@/features/auth/actions";
import { requireUserProfile } from "@/features/auth/queries";
import { getBrandBuildProgress } from "@/features/dashboard/build-progress";
import { BrandBuildView } from "@/features/dashboard/components/BrandBuildView";
import { getIntakePageData } from "@/features/intake/queries";
import {
  canApproveIntakeRole,
  isIntakeSessionLocked,
} from "@/features/intake/schemas";

export const metadata: Metadata = {
  title: "Build Roadmap · Brand Integrated Brain | Bextudio Platform",
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

export default async function BrandBrainRoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { user, profile } = await requireUserProfile("/dashboard/brain/roadmap");
  const accessSummary = await getBrandAccessSummaryForProfile(profile.id);
  const email = user.email ?? profile.email;
  const params = await searchParams;
  const initialRawKey =
    typeof params.key === "string" ? params.key.trim() : "";

  if (
    accessSummary.status === "ACTIVE_ACCESS" &&
    accessSummary.brandId &&
    accessSummary.brandName
  ) {
    const intakeDataPromise = getIntakePageData({ profileId: profile.id });
    const [buildProgress, intakeData] = await Promise.all([
      getBrandBuildProgress(accessSummary.brandId, accessSummary.brandName, {
        intakeData: intakeDataPromise,
      }),
      intakeDataPromise,
    ]);

    const intakeSessionId = intakeData?.session.id ?? null;
    const intakeCompletion = intakeData?.completion ?? null;
    const intakeLocked = intakeData
      ? isIntakeSessionLocked(intakeData.session)
      : false;
    const intakeCanApprove = intakeData
      ? canApproveIntakeRole(intakeData.access.membershipRole)
      : false;

    return (
      <div style={{ color: "var(--bv-ink)" }}>
        <BrandBuildView
          intakeCanApprove={intakeCanApprove}
          intakeCompletion={intakeLocked ? null : intakeCompletion}
          intakeSessionId={intakeLocked ? null : intakeSessionId}
          progress={buildProgress}
        />
      </div>
    );
  }

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Identity verified
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Brand Integrated Brain
          </h1>
        </div>
        <InactiveDashboardState
          email={email}
          initialRawKey={initialRawKey}
          signOutAction={<SignOutButton />}
        />
      </section>
    </main>
  );
}
