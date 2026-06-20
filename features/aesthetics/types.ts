import type { AestheticsKind } from "@/lib/routes";

export const aestheticsDeliverableStatuses = [
  "PENDING_UPLOAD",
  "CLIENT_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
] as const;

export type AestheticsDeliverableStatus =
  (typeof aestheticsDeliverableStatuses)[number];

export type AestheticsDeliverableFile = {
  id: string;
  storagePath: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type AestheticsDeliverableReport = {
  id: string;
  brandId: string;
  kind: AestheticsKind;
  status: AestheticsDeliverableStatus;
  file: AestheticsDeliverableFile | null;
  uploadedAt: string | null;
  approvedAt: string | null;
};

export type AestheticsAccess = {
  brandId: string;
  brandName: string;
  membershipRole: string;
  planName: string | null;
};

export type AestheticsWorkspace = {
  access: AestheticsAccess | null;
  kind: AestheticsKind;
  report: AestheticsDeliverableReport | null;
  markdown: string | null;
  comments: import("@/features/review-comments/types").ReviewComment[];
  signedUrl: string | null;
  inlineUrl: string | null;
  canReview: boolean;
};

export type AestheticsActionState = {
  status: "idle" | "error" | "success";
  message: string;
};
