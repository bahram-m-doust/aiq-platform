import "server-only";

import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { buildStoragePath } from "@/features/documents/schema";
import { uploadPrivateFile } from "@/features/documents/storage";
import { removePrivateFileOrQueue } from "@/features/documents/storage-cleanup";
import { removeFileRecordAndStorage } from "@/features/review-deliverables/detach-service";
import { generateAndCacheDeliverableMarkdown } from "@/features/review-content/resolve";
import { logServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function uploadCityModelDistrictFile({
  brandId,
  districtKey,
  profileId,
  file,
}: {
  brandId: string;
  districtKey: string;
  profileId: string;
  file: File;
}): Promise<void> {
  const fileId = randomUUID();
  const storagePath = buildStoragePath({
    brandId,
    fileId,
    originalName: file.name,
  });

  await uploadPrivateFile({
    storagePath,
    file,
    mimeType: "application/pdf",
  });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("attach_city_model_district_file", {
    p_brand_id: brandId,
    p_district_key: districtKey,
    p_profile_id: profileId,
    p_file_id: fileId,
    p_storage_path: storagePath,
    p_original_name: file.name,
    p_mime_type: "application/pdf",
    p_size_bytes: file.size,
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
  const oldFileId =
    result && typeof result.old_file_id === "string"
      ? result.old_file_id
      : null;
  // The attach RPC swaps file_id but leaves the previous files row and storage
  // object behind — remove them here so re-uploads don't accumulate orphans.
  // Best-effort: a cleanup failure must not fail the upload that succeeded.
  if (oldFileId && oldFileId !== fileId) {
    try {
      await removeFileRecordAndStorage({
        fileId: oldFileId,
        reason: "REVIEW_DELIVERABLE_REPLACED",
      });
    } catch (cleanupError) {
      logServerError({
        label: "[city-model] replaced file cleanup failed",
        error: cleanupError,
        metadata: { brandId, districtKey, oldFileId },
      });
    }
  }

  // LLM markdown structuring (up to ~60s, internally non-fatal): defer past the
  // response so it doesn't block the upload. Mirrors uploadReviewDeliverable.
  const cacheMarkdown = () =>
    generateAndCacheDeliverableMarkdown({
      fileId,
      brandId,
      subjectType: "CITY_MODEL_DISTRICT",
      subjectId: districtKey,
      storagePath,
      mimeType: "application/pdf",
      originalName: file.name,
    });
  try {
    after(cacheMarkdown);
  } catch {
    void cacheMarkdown();
  }
}

export async function setCityModelDistrictStatus({
  brandId,
  districtKey,
  profileId,
  status,
}: {
  brandId: string;
  districtKey: string;
  profileId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
}): Promise<void> {
  const now = new Date().toISOString();
  const patch =
    status === "APPROVED"
      ? { status, approved_by: profileId, approved_at: now, updated_at: now }
      : { status, approved_by: null, approved_at: null, updated_at: now };

  const admin = createAdminClient();
  const { error } = await admin
    .from("city_model_district_files")
    .update(patch)
    .eq("brand_id", brandId)
    .eq("district_key", districtKey);

  if (error) throw error;
}
