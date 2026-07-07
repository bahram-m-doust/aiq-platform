"use client";

import { DeliverablePendingState } from "@/components/review/DeliverablePendingState";
import { ReviewSurface } from "@/components/review/ReviewSurface";
import { AESTHETICS_PHASE_LABELS } from "@/features/app/roadmap-phase-labels";
import { approveAestheticsDeliverableAction } from "@/features/aesthetics/actions";
import type { AestheticsWorkspace } from "@/features/aesthetics/types";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";
import type { AestheticsKind } from "@/lib/routes";

const kindMeta: Record<
  AestheticsKind,
  { title: string; description: string }
> = {
  VISUAL_DIRECTION: {
    title: "Visual Direction",
    description:
      "The brand's core visual aesthetic direction — mood, inspiration, and tone. Review the direction board and approve it to confirm the visual language the brand will build on.",
  },
  COLOR_TYPE_SYSTEM: {
    title: "Color & Type System",
    description:
      "The brand's color palette and typographic system. Review the colour and type pairings, comment on anything to adjust, and approve once the system is right.",
  },
  ASSET_LIBRARY: {
    title: "Asset Library",
    description:
      "The brand's core visual asset collection — icons, textures, illustrations, and photography. Review the library, flag anything to replace, and approve once complete.",
  },
};

function PreparingState({ kind }: { kind: AestheticsKind }) {
  const { title } = kindMeta[kind];
  return (
    <div className="px-2 pt-[15px]">
      <div className="mx-auto w-full max-w-[1057px]">
        <DeliverablePendingState
          eyebrow={AESTHETICS_PHASE_LABELS[kind]}
          eyebrowVariant="roadmap"
          body="The AIQ STUDIO team is finalising this deliverable. You will be able to review and approve it here once it is uploaded."
          headline={`Your ${title.toLowerCase()} is being prepared.`}
          title={title}
        />
      </div>
    </div>
  );
}

export function AestheticsDeliverableView({
  workspace,
  currentUserId,
}: {
  workspace: AestheticsWorkspace;
  currentUserId: string;
}) {
  const { report, markdown, comments, canReview, signedUrl, inlineUrl, kind } =
    workspace;
  const status = report?.status ?? "PENDING_UPLOAD";
  const canDecide =
    canReview && (status === "CLIENT_REVIEW" || status === "CHANGES_REQUESTED");
  const meta = kindMeta[kind];

  return (
    <ReviewSurface
      canComment={canReview}
      comments={comments}
      currentUserId={currentUserId}
      description={meta.description}
      decision={{
        canDecide,
        isApproved: status === "APPROVED",
        onApprove: () => approveAestheticsDeliverableAction({ kind }),
      }}
      emptyState={<PreparingState kind={kind} />}
      eyebrow={AESTHETICS_PHASE_LABELS[kind]}
      eyebrowVariant="roadmap"
      inlineUrl={inlineUrl}
      markdown={markdown}
      signedUrl={signedUrl}
      statusBadge={<DeliverableStatusBadge status={status} />}
      subjectId={report?.id ?? ""}
      subjectType={kind}
      title={meta.title}
    />
  );
}
