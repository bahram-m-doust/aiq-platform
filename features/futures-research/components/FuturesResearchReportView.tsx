"use client";

import { DeliverablePendingState } from "@/components/review/DeliverablePendingState";
import { ReviewSurface } from "@/components/review/ReviewSurface";
import { approveFuturesResearchReportAction } from "@/features/futures-research/actions";
import type { FuturesResearchWorkspace } from "@/features/futures-research/types";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";

function PreparingState() {
  return (
    <div className="px-2 pt-[15px]">
      <div className="mx-auto w-full max-w-[756px]">
        <DeliverablePendingState
          body="The Bextudio team is finalising the report. You will be able to review and approve it here once it is uploaded."
          headline="Your futures research analysis is being prepared."
          title="Futures Research"
        />
      </div>
    </div>
  );
}

export function FuturesResearchReportView({
  workspace,
  currentUserId,
}: {
  workspace: FuturesResearchWorkspace;
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
      decision={{
        canDecide,
        isApproved: status === "APPROVED",
        onApprove: approveFuturesResearchReportAction,
      }}
      emptyState={<PreparingState />}
      eyebrow="Brand Research · Futures Research"
      inlineUrl={inlineUrl}
      markdown={markdown}
      signedUrl={signedUrl}
      statusBadge={<DeliverableStatusBadge status={status} />}
      subjectId={report?.id ?? ""}
      subjectType="FUTURES_RESEARCH"
      title="Futures Research"
    />
  );
}
