import type {
  FuturesResearchActionState,
  FuturesResearchReportStatus,
  FuturesResearchReviewRole,
} from "@/features/futures-research/types";
import {
  canReviewDeliverableRole,
  deliverableStatusLabels,
  isDeliverablePdf,
  normalizeReviewPosition,
  validateReviewAnnotationBody,
} from "@/features/review-deliverables/schema";

export const futuresResearchReportStatusLabels: Record<
  FuturesResearchReportStatus,
  string
> = deliverableStatusLabels;

export const initialFuturesResearchActionState: FuturesResearchActionState = {
  status: "idle",
  message: "",
};

export const maxFuturesResearchPdfBytes = 10 * 1024 * 1024;
export const maxFuturesResearchStorylineBytes = 5 * 1024 * 1024;

export function canReviewFuturesResearchRole(
  role: string | null | undefined,
): role is FuturesResearchReviewRole {
  return canReviewDeliverableRole(role);
}

export function isFuturesResearchPdf(file: File): boolean {
  return isDeliverablePdf(file, maxFuturesResearchPdfBytes);
}

export function isFuturesResearchStoryline(file: File): boolean {
  return (
    file.size <= maxFuturesResearchStorylineBytes &&
    file.type.toLowerCase() === "text/html" &&
    (file.name.toLowerCase().endsWith(".html") ||
      file.name.toLowerCase().endsWith(".htm"))
  );
}

export function validateAnnotationBody(body: string): {
  value: string | null;
  error: string | null;
} {
  return validateReviewAnnotationBody(body);
}

export function normalizePosition(value: number): number {
  return normalizeReviewPosition(value);
}
