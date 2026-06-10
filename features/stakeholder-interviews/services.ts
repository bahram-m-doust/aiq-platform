import "server-only";

import type { StakeholderAnnotation } from "@/features/stakeholder-interviews/types";
import { uploadReviewDeliverable } from "@/features/review-deliverables/upload-service";
import {
  createReviewAnnotation,
  deleteReviewAnnotation,
  setReviewAnnotationResolved,
  setReviewReportStatus,
  updateReviewAnnotation,
} from "@/features/review-deliverables/mutation-service";

export async function uploadStakeholderReport({
  brandId,
  profileId,
  file,
}: {
  brandId: string;
  profileId: string;
  file: File;
}): Promise<void> {
  await uploadReviewDeliverable({
    workflow: "STAKEHOLDER_INTERVIEWS",
    brandId,
    profileId,
    file,
    mimeType: "application/pdf",
  });
}

export async function addStakeholderAnnotation({
  reportId,
  profileId,
  page,
  posX,
  posY,
  body,
  parentId,
}: {
  reportId: string;
  profileId: string;
  page: number;
  posX: number;
  posY: number;
  body: string;
  parentId?: string | null;
}): Promise<StakeholderAnnotation> {
  return createReviewAnnotation({
    table: "stakeholder_interview_annotations",
    reportId,
    authorId: profileId,
    page,
    posX,
    posY,
    body,
    parentId,
  });
}

export async function updateStakeholderAnnotation({
  annotationId,
  reportId,
  authorId,
  body,
}: {
  annotationId: string;
  reportId: string;
  authorId: string;
  body: string;
}): Promise<void> {
  await updateReviewAnnotation({
    table: "stakeholder_interview_annotations",
    annotationId,
    reportId,
    authorId,
    body,
  });
}

export async function deleteStakeholderAnnotation({
  annotationId,
  reportId,
  authorId,
}: {
  annotationId: string;
  reportId: string;
  authorId: string;
}): Promise<void> {
  await deleteReviewAnnotation({
    table: "stakeholder_interview_annotations",
    annotationId,
    reportId,
    authorId,
  });
}

export async function setStakeholderAnnotationResolved({
  annotationId,
  reportId,
  resolved,
}: {
  annotationId: string;
  reportId: string;
  resolved: boolean;
}): Promise<void> {
  await setReviewAnnotationResolved({
    table: "stakeholder_interview_annotations",
    annotationId,
    reportId,
    resolved,
  });
}

export async function setStakeholderReportStatus({
  brandId,
  profileId,
  status,
}: {
  brandId: string;
  profileId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
}): Promise<void> {
  await setReviewReportStatus({
    table: "stakeholder_interview_reports",
    brandId,
    profileId,
    status,
  });
}
