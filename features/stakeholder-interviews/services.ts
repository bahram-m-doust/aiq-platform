import "server-only";

import { uploadReviewDeliverable } from "@/features/review-deliverables/upload-service";
import { setReviewReportStatus } from "@/features/review-deliverables/mutation-service";

export async function uploadStakeholderReport({
  brandId,
  profileId,
  file,
}: {
  brandId: string;
  profileId: string;
  file: File;
}): Promise<void> {
  await uploadReviewDeliverable({
    workflow: "STAKEHOLDER_INTERVIEWS",
    brandId,
    profileId,
    file,
    mimeType: "application/pdf",
  });
}

export async function setStakeholderReportStatus({
  brandId,
  profileId,
  status,
}: {
  brandId: string;
  profileId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
}): Promise<void> {
  await setReviewReportStatus({
    table: "stakeholder_interview_reports",
    brandId,
    profileId,
    status,
  });
}
