import type { AestheticsActionState } from "@/features/aesthetics/types";
import {
  canReviewDeliverableRole,
  deliverableStatusLabels,
  isDeliverablePdf,
} from "@/features/review-deliverables/schema";

export const aestheticsDeliverableStatusLabels = deliverableStatusLabels;

export const initialAestheticsActionState: AestheticsActionState = {
  status: "idle",
  message: "",
};

export const maxAestheticsPdfBytes = 10 * 1024 * 1024;

export function canReviewAestheticsRole(
  role: string | null | undefined,
): boolean {
  return canReviewDeliverableRole(role);
}

export function isAestheticsPdf(file: File): boolean {
  return isDeliverablePdf(file, maxAestheticsPdfBytes);
}
