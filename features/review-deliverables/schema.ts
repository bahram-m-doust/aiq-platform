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

