export const futuresResearchReportStatuses = [
  "PENDING_UPLOAD",
  "CLIENT_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
] as const;

export type FuturesResearchReportStatus =
  (typeof futuresResearchReportStatuses)[number];

export type FuturesResearchReviewRole = "OWNER" | "EXECUTIVE_MANAGER";

export type FuturesResearchFile = {
  id: string;
  storagePath: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type FuturesResearchReport = {
  id: string;
  brandId: string;
  status: FuturesResearchReportStatus;
  file: FuturesResearchFile | null;
  storylineFileId: string | null;
  uploadedAt: string | null;
  approvedAt: string | null;
};

export type FuturesResearchAccess = {
  brandId: string;
  brandName: string;
  membershipRole: string;
  planName: string | null;
};

export type FuturesResearchWorkspace = {
  access: FuturesResearchAccess | null;
  report: FuturesResearchReport | null;
  markdown: string | null;
  comments: import("@/features/review-comments/types").ReviewComment[];
  signedUrl: string | null;
  canReview: boolean;
};

export type FuturesResearchActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

