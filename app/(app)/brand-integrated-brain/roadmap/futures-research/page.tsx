import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import {
  addFuturesResearchAnnotationAction,
  approveFuturesResearchReportAction,
  deleteFuturesResearchAnnotationAction,
  editFuturesResearchAnnotationAction,
  resolveFuturesResearchAnnotationAction,
} from "@/features/futures-research/actions";
import { FuturesResearchHeader } from "@/features/futures-research/components/FuturesResearchHeader";
import { FuturesResearchWorkspaceView } from "@/features/futures-research/components/FuturesResearchWorkspaceView";
import { getFuturesResearchWorkspace } from "@/features/futures-research/queries";
import type { PdfReviewActions } from "@/features/stakeholder-interviews/components/PdfAnnotator";
import { PdfAnnotator } from "@/features/stakeholder-interviews/components/PdfAnnotator";

export const metadata: Metadata = {
  title: "Futures Research | Bextudio Platform",
};

export const dynamic = "force-dynamic";

const futuresResearchActions: PdfReviewActions = {
  addAnnotation: addFuturesResearchAnnotationAction,
  approveReport: approveFuturesResearchReportAction,
  deleteAnnotation: deleteFuturesResearchAnnotationAction,
  editAnnotation: editFuturesResearchAnnotationAction,
  resolveAnnotation: resolveFuturesResearchAnnotationAction,
};

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
  const hasPdf = Boolean(workspace.report?.file && workspace.signedUrl);
  const isApproved = status === "APPROVED";
  const editable =
    workspace.canReview &&
    (status === "CLIENT_REVIEW" || status === "CHANGES_REQUESTED");

  const storylineUrl =
    workspace.report && workspace.report.storylineFileId
      ? `/api/futures-research/storyline/${workspace.report.id}`
      : null;

  const reportNode =
    hasPdf && workspace.report && workspace.signedUrl ? (
      <PdfAnnotator
        actions={futuresResearchActions}
        canApprove={workspace.canReview}
        canResolve={workspace.canReview}
        currentUserId={profile.id}
        editable={editable}
        header={<FuturesResearchHeader status={status} />}
        initialAnnotations={workspace.annotations}
        isApproved={isApproved}
        reportId={workspace.report.id}
        signedUrl={workspace.signedUrl}
      />
    ) : (
      <div className="px-2 pt-[15px]">
        <div className="mx-auto flex w-full max-w-[756px] flex-col gap-6">
          <FuturesResearchHeader status={status} />
          <div className="rounded-[10px] border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Your futures research analysis is being prepared.
            </p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              The Bextudio team is finalising the report. You will be able to
              review and approve it here once it is uploaded.
            </p>
          </div>
        </div>
      </div>
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
