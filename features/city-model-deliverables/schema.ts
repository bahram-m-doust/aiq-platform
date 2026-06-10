import {
  canReviewDeliverableRole,
  isDeliverablePdf,
} from "@/features/review-deliverables/schema";
import type {
  CityModelDeliverableStatus,
  CityModelUploadState,
} from "@/features/city-model-deliverables/types";

export const initialCityModelUploadState: CityModelUploadState = {
  status: "idle",
  message: "",
};

export function toCityModelStatus(
  value: string | null | undefined,
): CityModelDeliverableStatus {
  switch (value) {
    case "CLIENT_REVIEW":
    case "CHANGES_REQUESTED":
    case "APPROVED":
      return value;
    default:
      return "PENDING_UPLOAD";
  }
}

export const canReviewCityModelRole = canReviewDeliverableRole;
export const isPdfFile = isDeliverablePdf;
