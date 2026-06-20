import "server-only";

import { setAestheticsDeliverableStatus } from "@/features/review-deliverables/mutation-service";
import { uploadReviewDeliverable } from "@/features/review-deliverables/upload-service";
import type { AestheticsKind } from "@/lib/routes";

export async function uploadAestheticsDeliverable({
  brandId,
  profileId,
  kind,
  file,
}: {
  brandId: string;
  profileId: string;
  kind: AestheticsKind;
  file: File;
}): Promise<void> {
  await uploadReviewDeliverable({
    workflow: kind,
    brandId,
    profileId,
    file,
    mimeType: "application/pdf",
  });
}

export async function setAestheticsStatus({
  brandId,
  kind,
  profileId,
  status,
}: {
  brandId: string;
  kind: AestheticsKind;
  profileId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
}): Promise<void> {
  await setAestheticsDeliverableStatus({ brandId, kind, profileId, status });
}
