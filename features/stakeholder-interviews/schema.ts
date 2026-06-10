import type {
  StakeholderActionState,
  StakeholderReportStatus,
  StakeholderReviewRole,
} from "@/features/stakeholder-interviews/types";
import {
  canReviewDeliverableRole,
  deliverableStatusLabels,
  isDeliverablePdf,
  normalizeReviewPosition,
  validateReviewAnnotationBody,
} from "@/features/review-deliverables/schema";

export const stakeholderReportStatusLabels: Record<
  StakeholderReportStatus,
  string
> = deliverableStatusLabels;

export const initialStakeholderActionState: StakeholderActionState = {
  status: "idle",
  message: "",
};

export function canReviewStakeholderInterviewRole(
  role: string | null | undefined,
): role is StakeholderReviewRole {
  return canReviewDeliverableRole(role);
}

export function isStakeholderPdf(file: File): boolean {
  return isDeliverablePdf(file);
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
