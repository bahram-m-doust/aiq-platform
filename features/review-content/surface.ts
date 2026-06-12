import "server-only";

import {
  createPrivateFileSignedDownloadUrl,
  createPrivateFileSignedInlineUrl,
} from "@/features/documents/storage";
import { listCommentsForSubject } from "@/features/review-comments/queries";
import type {
  ReviewComment,
  ReviewSubjectType,
} from "@/features/review-comments/types";
import { resolveDeliverableMarkdown } from "@/features/review-content/resolve";

export type ReviewSurfaceFile = {
  id: string;
  storagePath: string;
  originalName: string;
  mimeType: string | null;
};

export type ReviewSurfaceData = {
  markdown: string | null;
  signedUrl: string | null; // download (attachment) URL
  inlineUrl: string | null; // inline preview URL (PDF fallback)
  comments: ReviewComment[];
};

// Single source of truth for everything a reviewable deliverable surface needs:
// its markdown (cache → .md → extracted), its download + inline URLs, and its
// comments. Every surface query calls this once, so a change to how content is
// resolved or how URLs are signed applies everywhere at once.
export async function resolveReviewSurface({
  subjectType,
  subjectId,
  brandId,
  file,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  brandId: string;
  file: ReviewSurfaceFile | null;
}): Promise<ReviewSurfaceData> {
  if (!file) {
    const comments = await listCommentsForSubject({
      subjectType,
      subjectId,
      brandId,
    });
    return { markdown: null, signedUrl: null, inlineUrl: null, comments };
  }

  // All four are independent — resolve them concurrently so the comments query
  // never serializes behind the (potentially large) markdown resolution.
  const [comments, markdown, signedUrl, inlineUrl] = await Promise.all([
    listCommentsForSubject({ subjectType, subjectId, brandId }),
    resolveDeliverableMarkdown({
      fileId: file.id,
      storagePath: file.storagePath,
      mimeType: file.mimeType,
      originalName: file.originalName,
    }),
    createPrivateFileSignedDownloadUrl({
      storagePath: file.storagePath,
      downloadName: file.originalName,
    }),
    createPrivateFileSignedInlineUrl({ storagePath: file.storagePath }),
  ]);

  return { markdown, signedUrl, inlineUrl, comments };
}
