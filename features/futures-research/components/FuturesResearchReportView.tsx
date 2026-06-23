"use client";

import { DeliverablePendingState } from "@/components/review/DeliverablePendingState";
import { ReviewSurface } from "@/components/review/ReviewSurface";
import { ROADMAP_PHASE_LABELS } from "@/features/app/roadmap-phase-labels";
import { approveFuturesResearchReportAction } from "@/features/futures-research/actions";
import type { FuturesResearchWorkspace } from "@/features/futures-research/types";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";

function PreparingState() {
  return (
    <div className="px-2 pt-[15px]">
      <div className="mx-auto w-full max-w-[1057px]">
        <DeliverablePendingState
          eyebrow={ROADMAP_PHASE_LABELS.futuresResearch}
          eyebrowVariant="roadmap"
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
      description="A forward looking analysis of your market, industry, and competitors. We'll use these insights to build your Brand Brain. Read it through, comment on anything unclear, and approve it once it's accurate."
      decision={{
        canDecide,
        isApproved: status === "APPROVED",
        onApprove: approveFuturesResearchReportAction,
      }}
      emptyState={<PreparingState />}
      eyebrow={ROADMAP_PHASE_LABELS.futuresResearch}
      eyebrowVariant="roadmap"
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
