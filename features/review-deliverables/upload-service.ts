import "server-only";

import { randomUUID } from "node:crypto";

import { buildStoragePath } from "@/features/documents/schema";
import { uploadPrivateFile } from "@/features/documents/storage";
import {
  processPendingStorageCleanups,
  removePrivateFileOrQueue,
} from "@/features/documents/storage-cleanup";
import { createAdminClient } from "@/lib/supabase/admin";

type ReviewWorkflow =
  | "STAKEHOLDER_INTERVIEWS"
  | "FUTURES_RESEARCH"
  | "VISUAL_DIRECTION"
  | "COLOR_TYPE_SYSTEM"
  | "ASSET_LIBRARY";

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

  // Markdown is intentionally NOT structured on the upload request. The LLM pass
  // (structureTextAsMarkdown, bounded to 60s) used to run here via after(), but
  // on Netlify's serverless runtime after() callbacks are awaited before the
  // function can return — so a slow LLM call blocked the upload response past the
  // function timeout and surfaced as an unhandled 500. The viewer regenerates
  // markdown lazily on first view (resolveDeliverableMarkdown caches RAW text)
  // and the RAG sync upgrades it to LLM-structured markdown — neither blocks this
  // upload request.

  return reportId;
}
