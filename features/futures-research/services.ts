import "server-only";

import { setReviewReportStatus } from "@/features/review-deliverables/mutation-service";
import { uploadReviewDeliverable } from "@/features/review-deliverables/upload-service";

export async function uploadFuturesResearchReport({
  brandId,
  profileId,
  file,
}: {
  brandId: string;
  profileId: string;
  file: File;
}): Promise<void> {
  await uploadReviewDeliverable({
    workflow: "FUTURES_RESEARCH",
    brandId,
    profileId,
    file,
    mimeType: "application/pdf",
  });
}

export async function uploadFuturesResearchStoryline({
  brandId,
  profileId,
  file,
}: {
  brandId: string;
  profileId: string;
  file: File;
}): Promise<void> {
  await uploadReviewDeliverable({
    workflow: "FUTURES_RESEARCH",
    brandId,
    profileId,
    file,
    mimeType: "text/html",
    storyline: true,
  });
}

export async function setFuturesResearchReportStatus({
  brandId,
  profileId,
  status,
}: {
  brandId: string;
  profileId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
}): Promise<void> {
  await setReviewReportStatus({
    table: "futures_research_reports",
    brandId,
    profileId,
    status,
  });
}
