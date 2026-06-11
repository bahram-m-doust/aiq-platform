import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import { FuturesResearchHeader } from "@/features/futures-research/components/FuturesResearchHeader";
import { FuturesResearchReportView } from "@/features/futures-research/components/FuturesResearchReportView";
import { FuturesResearchWorkspaceView } from "@/features/futures-research/components/FuturesResearchWorkspaceView";
import { getFuturesResearchWorkspace } from "@/features/futures-research/queries";

export const metadata: Metadata = {
  title: "Futures Research | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function FuturesResearchPage() {
  const { profile } = await requireUserProfile(
    "/brand-integrated-brain/roadmap/futures-research",
  );
  const workspace = await getFuturesResearchWorkspace({
    profileId: profile.id,
  });

  if (!workspace.access) {
    redirect("/brand-integrated-brain/roadmap");
  }

  const status = workspace.report?.status ?? "PENDING_UPLOAD";

  const storylineUrl =
    workspace.report && workspace.report.storylineFileId
      ? `/api/futures-research/storyline/${workspace.report.id}`
      : null;

  const reportNode = (
    <FuturesResearchReportView
      currentUserId={profile.id}
      workspace={workspace}
    />
  );

  if (!storylineUrl) {
    return reportNode;
  }

  const storylineNode = (
    <div className="px-2 pt-[15px]">
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 lg:justify-center">
          <div className="flex w-full flex-col gap-4 lg:max-w-[756px]">
            <FuturesResearchHeader status={status} />
            <div className="w-full overflow-hidden rounded-[10px] border border-border bg-white">
              <iframe
                className="h-[82vh] w-full"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts"
                src={storylineUrl}
                title="Futures Research Storyline"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <FuturesResearchWorkspaceView report={reportNode} storyline={storylineNode} />
  );
}
