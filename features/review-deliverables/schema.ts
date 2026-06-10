// Every review deliverable (stakeholder interviews, futures research, city model
// districts) shares the same upload → review → approve lifecycle, so its status
// labels, reviewer role, and PDF check live here once.
export type DeliverableStatus =
  | "PENDING_UPLOAD"
  | "CLIENT_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED";

export const deliverableStatusLabels: Record<DeliverableStatus, string> = {
  PENDING_UPLOAD: "Awaiting upload",
  CLIENT_REVIEW: "In review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};

// Client reviewers are the brand's owner / executive manager.
export function canReviewDeliverableRole(
  role: string | null | undefined,
): boolean {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function isDeliverablePdf(file: File, maxBytes?: number): boolean {
  const isPdf =
    file.type.toLowerCase() === "application/pdf" &&
    file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return false;
  return maxBytes === undefined || file.size <= maxBytes;
}

const maxAnnotationLength = 4000;

export function validateReviewAnnotationBody(body: string): {
  value: string | null;
  error: string | null;
} {
  const trimmed = body.trim();
  if (!trimmed) return { value: null, error: "Enter a comment." };
  if (trimmed.length > maxAnnotationLength) {
    return {
      value: null,
      error: `Comment must be ${maxAnnotationLength} characters or fewer.`,
    };
  }
  return { value: trimmed, error: null };
}

export function normalizeReviewPosition(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
