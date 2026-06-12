"use client";

import { DeliverablePendingState } from "@/components/review/DeliverablePendingState";
import { ReviewSurface } from "@/components/review/ReviewSurface";
import {
  approveCityModelDistrictAction,
  requestCityModelDistrictChangesAction,
} from "@/features/city-model-deliverables/actions";
import type { CityModelDistrictWorkspace } from "@/features/city-model-deliverables/types";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";

export function CityModelDistrictView({
  slug,
  workspace,
  currentUserId,
}: {
  slug: string;
  workspace: CityModelDistrictWorkspace;
  currentUserId: string;
}) {
  const { district, status, markdown, comments, canReview, downloadUrl, signedUrl } =
    workspace;
  const canDecide = canReview && status === "CLIENT_REVIEW";

  const emptyState = (
    <main className="min-h-svh px-4 py-6 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-[860px]">
        <DeliverablePendingState
          body="The Bextudio team will upload it here for your review and approval."
          eyebrow="City Model · District"
          headline="This district's deliverable is being prepared."
          title={district.name}
        />
      </section>
    </main>
  );

  return (
    <ReviewSurface
      canComment={canReview}
      comments={comments}
      currentUserId={currentUserId}
      decision={{
        canDecide,
        isApproved: status === "APPROVED",
        onApprove: () => approveCityModelDistrictAction(slug),
        onRequestChanges: () => requestCityModelDistrictChangesAction(slug),
      }}
      description={district.description}
      downloadName={workspace.fileName}
      emptyState={emptyState}
      eyebrow="City Model · District"
      inlineUrl={signedUrl}
      markdown={markdown}
      signedUrl={downloadUrl}
      statusBadge={<DeliverableStatusBadge status={status} />}
      subjectId={district.slug}
      subjectType="CITY_MODEL_DISTRICT"
      title={district.name}
    />
  );
}
