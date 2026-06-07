import type {
  StakeholderActionState,
  StakeholderReportStatus,
  StakeholderReviewRole,
} from "@/features/stakeholder-interviews/types";

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

const maxAnnotationLength = 4000;

export function canReviewStakeholderInterviewRole(
  role: string | null | undefined,
): role is StakeholderReviewRole {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function isStakeholderPdf(file: File): boolean {
  return (
    file.type.toLowerCase() === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
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
