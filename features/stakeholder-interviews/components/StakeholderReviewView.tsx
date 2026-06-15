"use client";

import { DeliverablePendingState } from "@/components/review/DeliverablePendingState";
import { ReviewSurface } from "@/components/review/ReviewSurface";
import { approveStakeholderReportAction } from "@/features/stakeholder-interviews/actions";
import type { StakeholderInterviewWorkspace } from "@/features/stakeholder-interviews/types";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";

function PreparingState() {
  return (
    <div className="px-2 pt-[15px]">
      <div className="mx-auto w-full max-w-[756px]">
        <DeliverablePendingState
          body="The Bextudio team is finalising the report. You will be able to review and approve it here once it is uploaded."
          headline="Your interview analysis is being prepared."
          title="Stakeholder Interviews"
        />
      </div>
    </div>
  );
}

export function StakeholderReviewView({
  workspace,
  currentUserId,
}: {
  workspace: StakeholderInterviewWorkspace;
  currentUserId: string;
}) {
  const { report, markdown, comments, canReview, signedUrl, inlineUrl } =
    workspace;
  const status = report?.status ?? "PENDING_UPLOAD";
  const canDecide =
    canReview && (status === "CLIENT_REVIEW" || status === "CHANGES_REQUESTED");

  return (
    <ReviewSurface
      canComment={canReview}
      comments={comments}
      currentUserId={currentUserId}
      description="This report summarizes the stakeholder interviews conducted by the Bextudio team. We'll use these insights to build your Brand Brain. Read it through, comment on anything unclear, and approve it once it's accurate."
      decision={{
        canDecide,
        isApproved: status === "APPROVED",
        onApprove: approveStakeholderReportAction,
      }}
      emptyState={<PreparingState />}
      eyebrow="Brand Research · Stakeholder Interviews"
      inlineUrl={inlineUrl}
      markdown={markdown}
      signedUrl={signedUrl}
      statusBadge={<DeliverableStatusBadge status={status} />}
      subjectId={report?.id ?? ""}
      subjectType="STAKEHOLDER_INTERVIEWS"
      title="Stakeholder Interviews"
    />
  );
}
