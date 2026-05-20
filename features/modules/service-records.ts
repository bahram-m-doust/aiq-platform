import "server-only";

import type {
  ModuleArtifactRecord,
  ModuleRecord,
  ModuleReviewRecord,
} from "@/features/modules/types";

export type ArtifactRow = {
  id: string;
  module_id: string;
  artifact_type: string;
  file_id: string | null;
  version: number | null;
  status: string | null;
  uploaded_by: string | null;
  created_at: string | null;
};

export type ReviewRow = {
  id: string;
  module_id: string;
  reviewer_id: string;
  review_type: string;
  decision: string;
  comment: string | null;
  created_at: string | null;
};

export const artifactColumns = [
  "id",
  "module_id",
  "artifact_type",
  "file_id",
  "version",
  "status",
  "uploaded_by",
  "created_at",
].join(", ");

export const reviewColumns = [
  "id",
  "module_id",
  "reviewer_id",
  "review_type",
  "decision",
  "comment",
  "created_at",
].join(", ");

export function toTemporaryArtifactRecord({
  row,
  brandModule,
  file,
}: {
  row: ArtifactRow;
  brandModule: ModuleRecord;
  file: ModuleArtifactRecord["file"];
}): ModuleArtifactRecord {
  return {
    id: row.id,
    moduleId: row.module_id,
    artifactType: row.artifact_type === "DOCX" ? "DOCX" : "PDF",
    fileId: row.file_id,
    version: row.version ?? 1,
    status: row.status ?? "INTERNAL_DRAFT",
    uploadedBy: row.uploaded_by,
    uploadedByEmail: null,
    createdAt: row.created_at,
    file: file
      ? {
          ...file,
          brandId: brandModule.brandId,
        }
      : null,
  };
}

export function toTemporaryReviewRecord(row: ReviewRow): ModuleReviewRecord {
  return {
    id: row.id,
    moduleId: row.module_id,
    reviewerId: row.reviewer_id,
    reviewerEmail: null,
    reviewType: row.review_type === "SUPERVISOR" ? "SUPERVISOR" : "CLIENT",
    decision:
      row.decision === "APPROVED_FOR_CLIENT_REVIEW" ||
      row.decision === "APPROVED" ||
      row.decision === "CHANGE_REQUESTED"
        ? row.decision
        : "COMMENT",
    comment: row.comment,
    createdAt: row.created_at,
  };
}
