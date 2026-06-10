import "server-only";

import type { FuturesResearchAnnotation } from "@/features/futures-research/types";
import {
  createReviewAnnotation,
  deleteReviewAnnotation,
  setReviewAnnotationResolved,
  setReviewReportStatus,
  updateReviewAnnotation,
} from "@/features/review-deliverables/mutation-service";
import { uploadReviewDeliverable } from "@/features/review-deliverables/upload-service";

export async function uploadFuturesResearchReport({
  brandId,
  profileId,
  file,
}: {
  brandId: string;
  profileId: string;
  file: File;
}): Promise<void> {
  await uploadReviewDeliverable({
    workflow: "FUTURES_RESEARCH",
    brandId,
    profileId,
    file,
    mimeType: "application/pdf",
  });
}

export async function uploadFuturesResearchStoryline({
  brandId,
  profileId,
  file,
}: {
  brandId: string;
  profileId: string;
  file: File;
}): Promise<void> {
  await uploadReviewDeliverable({
    workflow: "FUTURES_RESEARCH",
    brandId,
    profileId,
    file,
    mimeType: "text/html",
    storyline: true,
  });
}

export async function addFuturesResearchAnnotation({
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
}): Promise<FuturesResearchAnnotation> {
  return createReviewAnnotation({
    table: "futures_research_annotations",
    reportId,
    authorId: profileId,
    page,
    posX,
    posY,
    body,
    parentId,
  });
}

export async function updateFuturesResearchAnnotation({
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
    table: "futures_research_annotations",
    annotationId,
    reportId,
    authorId,
    body,
  });
}

export async function deleteFuturesResearchAnnotation({
  annotationId,
  reportId,
  authorId,
}: {
  annotationId: string;
  reportId: string;
  authorId: string;
}): Promise<void> {
  await deleteReviewAnnotation({
    table: "futures_research_annotations",
    annotationId,
    reportId,
    authorId,
  });
}

export async function setFuturesResearchAnnotationResolved({
  annotationId,
  reportId,
  resolved,
}: {
  annotationId: string;
  reportId: string;
  resolved: boolean;
}): Promise<void> {
  await setReviewAnnotationResolved({
    table: "futures_research_annotations",
    annotationId,
    reportId,
    resolved,
  });
}

export async function setFuturesResearchReportStatus({
  brandId,
  profileId,
  status,
}: {
  brandId: string;
  profileId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
}): Promise<void> {
  await setReviewReportStatus({
    table: "futures_research_reports",
    brandId,
    profileId,
    status,
  });
}
