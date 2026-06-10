import type {
  StakeholderActionState,
  StakeholderReportStatus,
  StakeholderReviewRole,
} from "@/features/stakeholder-interviews/types";
import {
  normalizeReviewPosition,
  validateReviewAnnotationBody,
} from "@/features/review-deliverables/schema";

export const stakeholderReportStatusLabels: Record<
  StakeholderReportStatus,
  string
> = {
  PENDING_UPLOAD: "Awaiting upload",
  CLIENT_REVIEW: "In review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};

export const initialStakeholderActionState: StakeholderActionState = {
  status: "idle",
  message: "",
};

export function canReviewStakeholderInterviewRole(
  role: string | null | undefined,
): role is StakeholderReviewRole {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function isStakeholderPdf(file: File): boolean {
  return (
    file.type.toLowerCase() === "application/pdf" &&
    file.name.toLowerCase().endsWith(".pdf")
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
