import type {
  FuturesResearchActionState,
  FuturesResearchReportStatus,
  FuturesResearchReviewRole,
} from "@/features/futures-research/types";
import {
  normalizeReviewPosition,
  validateReviewAnnotationBody,
} from "@/features/review-deliverables/schema";

export const futuresResearchReportStatusLabels: Record<
  FuturesResearchReportStatus,
  string
> = {
  PENDING_UPLOAD: "Awaiting upload",
  CLIENT_REVIEW: "In review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};

export const initialFuturesResearchActionState: FuturesResearchActionState = {
  status: "idle",
  message: "",
};

export const maxFuturesResearchPdfBytes = 10 * 1024 * 1024;
export const maxFuturesResearchStorylineBytes = 5 * 1024 * 1024;

export function canReviewFuturesResearchRole(
  role: string | null | undefined,
): role is FuturesResearchReviewRole {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function isFuturesResearchPdf(file: File): boolean {
  return (
    file.size <= maxFuturesResearchPdfBytes &&
    file.type.toLowerCase() === "application/pdf" &&
    file.name.toLowerCase().endsWith(".pdf")
  );
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
