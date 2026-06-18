import "server-only";

import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { buildStoragePath } from "@/features/documents/schema";
import { uploadPrivateFile } from "@/features/documents/storage";
import {
  processPendingStorageCleanups,
  removePrivateFileOrQueue,
} from "@/features/documents/storage-cleanup";
import { generateAndCacheDeliverableMarkdown } from "@/features/review-content/resolve";
import { createAdminClient } from "@/lib/supabase/admin";

type ReviewWorkflow = "STAKEHOLDER_INTERVIEWS" | "FUTURES_RESEARCH";

export async function uploadReviewDeliverable({
  workflow,
  brandId,
  profileId,
  file,
  mimeType,
  storyline = false,
}: {
  workflow: ReviewWorkflow;
  brandId: string;
  profileId: string;
  file: File;
  mimeType: string;
  storyline?: boolean;
}): Promise<string> {
  const fileId = randomUUID();
  const storagePath = buildStoragePath({
    brandId,
    fileId,
    originalName: file.name,
  });

  await uploadPrivateFile({ storagePath, file, mimeType });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("attach_review_deliverable", {
    p_workflow: workflow,
    p_brand_id: brandId,
    p_profile_id: profileId,
    p_file_id: fileId,
    p_storage_path: storagePath,
    p_original_name: file.name,
    p_mime_type: mimeType,
    p_size_bytes: file.size,
    p_storyline: storyline,
  });

  if (error) {
    await removePrivateFileOrQueue({
      storagePath,
      fileId,
      reason: "UPLOAD_ROLLBACK",
    });
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  const reportId =
    result && typeof result.report_id === "string" ? result.report_id : null;
  const oldFileId =
    result && typeof result.old_file_id === "string"
      ? result.old_file_id
      : null;
  if (!reportId) {
    throw new Error("Review deliverable attachment returned no report.");
  }

  if (oldFileId && oldFileId !== fileId) {
    await processPendingStorageCleanups(oldFileId);
  }
  await processPendingStorageCleanups(undefined, 3);

  // Structure the uploaded report into markdown with headings for the viewer +
  // RAG. The storyline is interactive HTML, not a text deliverable — skip it.
  // This runs an LLM pass (up to ~60s) and is internally non-fatal, so defer it
  // past the response instead of blocking the upload request. after() runs it
  // post-response; the fallback covers contexts where after() is unavailable.
  if (!storyline) {
    const cacheMarkdown = () =>
      generateAndCacheDeliverableMarkdown({
        fileId,
        brandId,
        subjectType: workflow,
        subjectId: reportId,
        storagePath,
        mimeType,
        originalName: file.name,
      });
    try {
      after(cacheMarkdown);
    } catch {
      void cacheMarkdown();
    }
  }

  return reportId;
}
