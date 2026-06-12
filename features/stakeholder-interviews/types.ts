export const stakeholderReportStatuses = [
  "PENDING_UPLOAD",
  "CLIENT_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
] as const;

export type StakeholderReportStatus =
  (typeof stakeholderReportStatuses)[number];

export type StakeholderReviewRole = "OWNER" | "EXECUTIVE_MANAGER";

export type StakeholderInterviewFile = {
  id: string;
  storagePath: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type StakeholderInterviewReport = {
  id: string;
  brandId: string;
  status: StakeholderReportStatus;
  file: StakeholderInterviewFile | null;
  uploadedAt: string | null;
  approvedAt: string | null;
};

export type StakeholderInterviewAccess = {
  brandId: string;
  brandName: string;
  membershipRole: string;
  planName: string | null;
};

export type StakeholderInterviewWorkspace = {
  access: StakeholderInterviewAccess | null;
  report: StakeholderInterviewReport | null;
  markdown: string | null;
  comments: import("@/features/review-comments/types").ReviewComment[];
  signedUrl: string | null;
  inlineUrl: string | null;
  canReview: boolean;
};

export type StakeholderActionState = {
  status: "idle" | "error" | "success";
  message: string;
};
