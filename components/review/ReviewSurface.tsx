"use client";

import { useMemo, type ReactNode } from "react";

import {
  ReviewableDocumentViewer,
  type ReviewCommentActions,
  type ReviewDecision,
} from "@/components/review/ReviewableDocumentViewer";
import {
  addReviewCommentAction,
  deleteReviewCommentAction,
  editReviewCommentAction,
  resolveReviewCommentAction,
} from "@/features/review-comments/actions";
import type {
  ReviewComment,
  ReviewSubjectType,
} from "@/features/review-comments/types";
import { splitMarkdownIntoBlocks } from "@/lib/markdown/blocks";

// The standard comment action set, wired once. Every surface uses this.
export const reviewCommentActions: ReviewCommentActions = {
  add: addReviewCommentAction,
  edit: editReviewCommentAction,
  remove: deleteReviewCommentAction,
  resolve: resolveReviewCommentAction,
};

// The standard reviewable surface: splits markdown into anchored blocks, shows
// the "not ready" empty state when there is no file, and otherwise renders the
// unified viewer (with its PDF fallback). Every deliverable surface renders
// through this, so layout/empty-state/viewer changes happen in one place.
export function ReviewSurface({
  subjectType,
  subjectId,
  title,
  eyebrow,
  description,
  statusBadge,
  markdown,
  comments,
  signedUrl,
  inlineUrl,
  downloadName,
  currentUserId,
  canComment,
  decision,
  emptyState,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  title: string;
  eyebrow?: string | null;
  description?: string | null;
  statusBadge?: ReactNode;
  markdown: string | null;
  comments: ReviewComment[];
  signedUrl: string | null;
  inlineUrl: string | null;
  downloadName?: string | null;
  currentUserId: string;
  canComment: boolean;
  decision?: ReviewDecision | null;
  emptyState: ReactNode;
}) {
  const blocks = useMemo(
    () => (markdown ? splitMarkdownIntoBlocks(markdown) : []),
    [markdown],
  );
  const hasFile = Boolean(inlineUrl || signedUrl);

  if (!hasFile) {
    return <>{emptyState}</>;
  }

  return (
    <ReviewableDocumentViewer
      actions={reviewCommentActions}
      blocks={blocks}
      canComment={canComment}
      currentUserId={currentUserId}
      decision={decision}
      description={description}
      downloadName={downloadName}
      downloadUrl={signedUrl}
      eyebrow={eyebrow}
      fileUrl={inlineUrl}
      initialComments={comments}
      statusBadge={statusBadge}
      subjectId={subjectId}
      subjectType={subjectType}
      title={title}
    />
  );
}
