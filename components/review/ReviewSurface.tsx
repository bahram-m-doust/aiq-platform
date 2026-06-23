"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";

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
  eyebrowVariant = "default",
  description,
  introCard,
  contentCardClassName,
  contentCardStyle,
  contentFrameClassName,
  emptyCommentsState,
  enablePdfSearch = false,
  showSelectionHint = true,
  statusBadge,
  markdown,
  comments,
  signedUrl,
  inlineUrl,
  currentUserId,
  canComment,
  contextBrandId,
  decision,
  emptyState,
  showHeaderDownload = true,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  title: string;
  eyebrow?: string | null;
  eyebrowVariant?: "default" | "roadmap";
  description?: string | null;
  introCard?: ReactNode;
  contentCardClassName?: string;
  contentCardStyle?: CSSProperties;
  contentFrameClassName?: string;
  emptyCommentsState?: ReactNode;
  enablePdfSearch?: boolean;
  showSelectionHint?: boolean;
  statusBadge?: ReactNode;
  markdown: string | null;
  comments: ReviewComment[];
  signedUrl: string | null;
  inlineUrl: string | null;
  currentUserId: string;
  canComment: boolean;
  // Internal admin review surface only — see ReviewableDocumentViewer.
  contextBrandId?: string;
  decision?: ReviewDecision | null;
  emptyState: ReactNode;
  showHeaderDownload?: boolean;
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
      contextBrandId={contextBrandId}
      currentUserId={currentUserId}
      decision={decision}
      description={description}
      downloadUrl={signedUrl ?? inlineUrl}
      eyebrow={eyebrow}
      eyebrowVariant={eyebrowVariant}
      fileUrl={inlineUrl}
      contentCardClassName={contentCardClassName}
      contentCardStyle={contentCardStyle}
      contentFrameClassName={contentFrameClassName}
      emptyCommentsState={emptyCommentsState}
      enablePdfSearch={enablePdfSearch}
      introCard={introCard}
      initialComments={comments}
      showSelectionHint={showSelectionHint}
      showHeaderDownload={showHeaderDownload}
      statusBadge={statusBadge}
      subjectId={subjectId}
      subjectType={subjectType}
      title={title}
    />
  );
}
