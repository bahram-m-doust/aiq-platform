"use client";

import { DeliverablePendingState } from "@/components/review/DeliverablePendingState";
import { ReviewSurface } from "@/components/review/ReviewSurface";
import { ROADMAP_PHASE_LABELS } from "@/features/app/roadmap-phase-labels";
import { approveCityModelDistrictAction } from "@/features/city-model-deliverables/actions";
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
      <section className="mx-auto w-full max-w-[1057px]">
        <DeliverablePendingState
          body="The AIQ STUDIO team will upload it here for your review and approval."
          eyebrow={ROADMAP_PHASE_LABELS.cityModelDistrict}
          eyebrowVariant="roadmap"
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
      }}
      description={district.description}
      emptyState={emptyState}
      eyebrow={ROADMAP_PHASE_LABELS.cityModelDistrict}
      eyebrowVariant="roadmap"
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
