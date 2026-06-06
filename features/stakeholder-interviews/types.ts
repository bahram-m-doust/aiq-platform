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

export type StakeholderAnnotation = {
  id: string;
  reportId: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  page: number;
  posX: number;
  posY: number;
  body: string;
  resolved: boolean;
  createdAt: string | null;
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
  annotations: StakeholderAnnotation[];
  signedUrl: string | null;
  canReview: boolean;
};

export type StakeholderActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

export type AddAnnotationInput = {
  reportId: string;
  page: number;
  posX: number;
  posY: number;
  body: string;
  parentId?: string | null;
};

export type AddAnnotationResult =
  | { ok: true; annotation: StakeholderAnnotation }
  | { ok: false; message: string };
