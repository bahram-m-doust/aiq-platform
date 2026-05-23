import "server-only";

import {
  artifactColumns,
  reviewColumns,
  type ArtifactRow,
  type ReviewRow,
} from "@/features/modules/queries";
import type {
  ModuleArtifactRecord,
  ModuleRecord,
  ModuleReviewRecord,
} from "@/features/modules/types";

export { artifactColumns, reviewColumns };
export type { ArtifactRow, ReviewRow };

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
