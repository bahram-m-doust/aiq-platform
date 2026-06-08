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

export type FuturesResearchAnnotation = {
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

export type FuturesResearchReport = {
  id: string;
  brandId: string;
  status: FuturesResearchReportStatus;
  file: FuturesResearchFile | null;
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
  annotations: FuturesResearchAnnotation[];
  signedUrl: string | null;
  canReview: boolean;
};

export type FuturesResearchActionState = {
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
  | { ok: true; annotation: FuturesResearchAnnotation }
  | { ok: false; message: string };
