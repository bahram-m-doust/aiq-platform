"use client";

import { DeleteDeliverableButton } from "@/components/admin/DeleteDeliverableButton";
import { deleteFuturesResearchReportAction } from "@/features/futures-research/actions";

export function FuturesResearchDeleteButton({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  return (
    <DeleteDeliverableButton
      description={`This permanently removes the uploaded futures-research file (and any attached storyline) for “${brandName}”. The brand returns to “Awaiting upload”. This cannot be undone.`}
      label="Delete"
      onDelete={() => deleteFuturesResearchReportAction({ brandId })}
      title={`Delete ${brandName} report?`}
    />
  );
}
