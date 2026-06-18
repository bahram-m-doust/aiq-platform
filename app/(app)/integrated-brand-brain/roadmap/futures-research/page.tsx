import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import { FuturesResearchReportView } from "@/features/futures-research/components/FuturesResearchReportView";
import { getFuturesResearchWorkspace } from "@/features/futures-research/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Futures Research | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function FuturesResearchPage() {
  const { profile } = await requireUserProfile(
    ROUTES.brainRoadmapFuturesResearch,
  );
  const workspace = await getFuturesResearchWorkspace({
    profileId: profile.id,
  });

  if (!workspace.access) {
    redirect(ROUTES.brainRoadmap);
  }

  // The Storyline tab is intentionally hidden on the client-facing review for
  // now; the admin upload still accepts a storyline so we can re-enable the
  // switcher (FuturesResearchWorkspaceView) here later without data loss.
  return (
    <FuturesResearchReportView
      currentUserId={profile.id}
      workspace={workspace}
    />
  );
}
