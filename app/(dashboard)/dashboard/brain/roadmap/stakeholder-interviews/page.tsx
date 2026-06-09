import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import {
  addStakeholderAnnotationAction,
  approveStakeholderReportAction,
  deleteStakeholderAnnotationAction,
  editStakeholderAnnotationAction,
  resolveStakeholderAnnotationAction,
} from "@/features/stakeholder-interviews/actions";
import type { PdfReviewActions } from "@/features/stakeholder-interviews/components/PdfAnnotator";
import { PdfAnnotator } from "@/features/stakeholder-interviews/components/PdfAnnotator";
import { StakeholderHeader } from "@/features/stakeholder-interviews/components/StakeholderHeader";
import { getStakeholderInterviewWorkspace } from "@/features/stakeholder-interviews/queries";

const stakeholderActions: PdfReviewActions = {
  addAnnotation: addStakeholderAnnotationAction,
  approveReport: approveStakeholderReportAction,
  deleteAnnotation: deleteStakeholderAnnotationAction,
  editAnnotation: editStakeholderAnnotationAction,
  resolveAnnotation: resolveStakeholderAnnotationAction,
};

export const metadata: Metadata = {
  title: "Stakeholder Interviews | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function StakeholderInterviewsPage() {
  const { profile } = await requireUserProfile(
    "/dashboard/brain/roadmap/stakeholder-interviews",
  );
  const workspace = await getStakeholderInterviewWorkspace({
    profileId: profile.id,
  });

  if (!workspace.access) {
    redirect("/dashboard/brain/roadmap");
  }

  const status = workspace.report?.status ?? "PENDING_UPLOAD";
  const hasPdf = Boolean(workspace.report?.file && workspace.signedUrl);
  const isApproved = status === "APPROVED";
  const editable =
    workspace.canReview &&
    (status === "CLIENT_REVIEW" || status === "CHANGES_REQUESTED");

  if (hasPdf && workspace.report && workspace.signedUrl) {
    return (
      <PdfAnnotator
        actions={stakeholderActions}
        canApprove={workspace.canReview}
        canResolve={workspace.canReview}
        currentUserId={profile.id}
        editable={editable}
        header={<StakeholderHeader status={status} />}
        initialAnnotations={workspace.annotations}
        isApproved={isApproved}
        reportId={workspace.report.id}
        signedUrl={workspace.signedUrl}
      />
    );
  }

  return (
    <div className="px-2 pt-[15px]">
      <div className="flex max-w-[756px] flex-col gap-6">
        <StakeholderHeader status={status} />
        <div className="rounded-[10px] border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            Your interview analysis is being prepared.
          </p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            The Bextudio team is finalising the report. You will be able to
            review and approve it here once it is uploaded.
          </p>
        </div>
      </div>
    </div>
  );
}
