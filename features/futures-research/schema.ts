import type {
  FuturesResearchActionState,
  FuturesResearchReportStatus,
  FuturesResearchReviewRole,
} from "@/features/futures-research/types";

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

const maxAnnotationLength = 4000;

export function canReviewFuturesResearchRole(
  role: string | null | undefined,
): role is FuturesResearchReviewRole {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function isFuturesResearchPdf(file: File): boolean {
  return (
    file.type.toLowerCase() === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export function isFuturesResearchStoryline(file: File): boolean {
  return (
    file.type.toLowerCase() === "text/html" ||
    file.name.toLowerCase().endsWith(".html") ||
    file.name.toLowerCase().endsWith(".htm")
  );
}

export function validateAnnotationBody(body: string): {
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

export function normalizePosition(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
