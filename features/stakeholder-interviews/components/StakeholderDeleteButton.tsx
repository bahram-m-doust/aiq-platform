"use client";

import { DeleteDeliverableButton } from "@/components/admin/DeleteDeliverableButton";
import { deleteStakeholderReportAction } from "@/features/stakeholder-interviews/actions";

export function StakeholderDeleteButton({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  return (
    <DeleteDeliverableButton
      description={`This permanently removes the uploaded interview-analysis file for “${brandName}” and any comments stay attached to the report. The brand returns to “Awaiting upload”. This cannot be undone.`}
      label="Delete"
      onDelete={() => deleteStakeholderReportAction({ brandId })}
      title={`Delete ${brandName} report?`}
    />
  );
}
