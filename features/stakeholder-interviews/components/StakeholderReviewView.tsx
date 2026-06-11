"use client";

import { useMemo } from "react";

import {
  ReviewableDocumentViewer,
  type ReviewCommentActions,
} from "@/components/review/ReviewableDocumentViewer";
import {
  addReviewCommentAction,
  deleteReviewCommentAction,
  editReviewCommentAction,
  resolveReviewCommentAction,
} from "@/features/review-comments/actions";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";
import {
  approveStakeholderReportAction,
  requestStakeholderChangesAction,
} from "@/features/stakeholder-interviews/actions";
import type { StakeholderInterviewWorkspace } from "@/features/stakeholder-interviews/types";
import { splitMarkdownIntoBlocks } from "@/lib/markdown/blocks";

const commentActions: ReviewCommentActions = {
  add: addReviewCommentAction,
  edit: editReviewCommentAction,
  remove: deleteReviewCommentAction,
  resolve: resolveReviewCommentAction,
};

export function StakeholderReviewView({
  workspace,
  currentUserId,
}: {
  workspace: StakeholderInterviewWorkspace;
  currentUserId: string;
}) {
  const { report, markdown, comments, canReview, signedUrl } = workspace;
  const blocks = useMemo(
    () => (markdown ? splitMarkdownIntoBlocks(markdown) : []),
    [markdown],
  );
  const status = report?.status ?? "PENDING_UPLOAD";
  const canDecide =
    canReview && (status === "CLIENT_REVIEW" || status === "CHANGES_REQUESTED");

  if (!report || !markdown || blocks.length === 0) {
    return (
      <div className="px-2 pt-[15px]">
        <div className="flex max-w-[756px] flex-col gap-6">
          <h1 className="text-2xl font-semibold">Stakeholder Interviews</h1>
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

  return (
    <ReviewableDocumentViewer
      actions={commentActions}
      blocks={blocks}
      canComment={canReview}
      currentUserId={currentUserId}
      decision={{
        canDecide,
        isApproved: status === "APPROVED",
        onApprove: approveStakeholderReportAction,
        onRequestChanges: requestStakeholderChangesAction,
      }}
      downloadName={report.file?.originalName}
      downloadUrl={signedUrl}
      eyebrow="Brand Research · Stakeholder Interviews"
      initialComments={comments}
      statusBadge={<DeliverableStatusBadge status={status} />}
      subjectId={report.id}
      subjectType="STAKEHOLDER_INTERVIEWS"
      title="Stakeholder Interviews"
    />
  );
}
