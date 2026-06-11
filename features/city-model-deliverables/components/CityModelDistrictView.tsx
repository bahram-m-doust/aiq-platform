"use client";

import { useMemo } from "react";

import {
  ReviewableDocumentViewer,
  type ReviewCommentActions,
} from "@/components/review/ReviewableDocumentViewer";
import {
  approveCityModelDistrictAction,
  requestCityModelDistrictChangesAction,
} from "@/features/city-model-deliverables/actions";
import type { CityModelDistrictWorkspace } from "@/features/city-model-deliverables/types";
import {
  addReviewCommentAction,
  deleteReviewCommentAction,
  editReviewCommentAction,
  resolveReviewCommentAction,
} from "@/features/review-comments/actions";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";
import { splitMarkdownIntoBlocks } from "@/lib/markdown/blocks";

const commentActions: ReviewCommentActions = {
  add: addReviewCommentAction,
  edit: editReviewCommentAction,
  remove: deleteReviewCommentAction,
  resolve: resolveReviewCommentAction,
};

export function CityModelDistrictView({
  slug,
  workspace,
  currentUserId,
}: {
  slug: string;
  workspace: CityModelDistrictWorkspace;
  currentUserId: string;
}) {
  const { district, status, markdown, comments, canReview, downloadUrl } =
    workspace;
  const blocks = useMemo(
    () => (markdown ? splitMarkdownIntoBlocks(markdown) : []),
    [markdown],
  );
  const canDecide = canReview && status === "CLIENT_REVIEW";

  if (!markdown || blocks.length === 0) {
    return (
      <main className="min-h-svh px-4 py-6 sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-[860px] space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            City Model · District
          </p>
          <h1 className="text-2xl font-semibold">{district.name}</h1>
          <div className="rounded-[10px] border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              This district&apos;s deliverable is being prepared.
            </p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              The Bextudio team will upload it here for your review and approval.
            </p>
          </div>
        </section>
      </main>
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
        onApprove: () => approveCityModelDistrictAction(slug),
        onRequestChanges: () => requestCityModelDistrictChangesAction(slug),
      }}
      description={district.description}
      downloadName={workspace.fileName}
      downloadUrl={downloadUrl}
      eyebrow="City Model · District"
      initialComments={comments}
      statusBadge={<DeliverableStatusBadge status={status} />}
      subjectId={district.slug}
      subjectType="CITY_MODEL_DISTRICT"
      title={district.name}
    />
  );
}
