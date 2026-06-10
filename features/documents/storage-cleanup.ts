import "server-only";

import { removePrivateFile } from "@/features/documents/storage";
import { logServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

type CleanupReason =
  | "UPLOAD_ROLLBACK"
  | "MODULE_UPLOAD_ROLLBACK"
  | "ADMIN_FILE_DELETED"
  | "REVIEW_DELIVERABLE_REPLACED";

type CleanupJob = {
  id: string;
  source_file_id: string | null;
  storage_path: string;
};

async function enqueueStorageCleanup({
  storagePath,
  fileId,
  reason,
}: {
  storagePath: string;
  fileId: string;
  reason: CleanupReason;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("enqueue_storage_cleanup", {
    p_storage_path: storagePath,
    p_source_file_id: fileId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function removePrivateFileOrQueue({
  storagePath,
  fileId,
  reason,
}: {
  storagePath: string;
  fileId: string;
  reason: CleanupReason;
}): Promise<boolean> {
  try {
    await removePrivateFile(storagePath);
    return true;
  } catch (error) {
    try {
      await enqueueStorageCleanup({ storagePath, fileId, reason });
    } catch (queueError) {
      logServerError({
        label: "[storage-cleanup] enqueue failed",
        error: queueError,
        metadata: { fileId, reason },
      });
    }
    logServerError({
      label: "[storage-cleanup] object removal deferred",
      error,
      metadata: { fileId, reason },
    });
    return false;
  }
}

async function processJob(job: CleanupJob): Promise<void> {
  const admin = createAdminClient();
  try {
    await removePrivateFile(job.storage_path);
    const { error } = await admin
      .from("storage_cleanup_jobs")
      .delete()
      .eq("id", job.id);
    if (error) throw error;
  } catch (error) {
    const { error: markError } = await admin.rpc(
      "mark_storage_cleanup_attempt",
      { p_job_id: job.id },
    );
    logServerError({
      label: "[storage-cleanup] retry failed",
      error: markError ?? error,
      metadata: { fileId: job.source_file_id, cleanupJobId: job.id },
    });
  }
}

export async function processPendingStorageCleanups(
  sourceFileId?: string,
  limit = 10,
): Promise<void> {
  const admin = createAdminClient();
  let query = admin
    .from("storage_cleanup_jobs")
    .select("id, source_file_id, storage_path")
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (sourceFileId) {
    query = query.eq("source_file_id", sourceFileId);
  }

  const { data, error } = await query;
  if (error) {
    logServerError({
      label: "[storage-cleanup] pending jobs query failed",
      error,
      metadata: { sourceFileId: sourceFileId ?? null },
    });
    return;
  }

  for (const job of (data ?? []) as CleanupJob[]) {
    await processJob(job);
  }
}
