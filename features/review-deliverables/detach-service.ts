import "server-only";

import { removePrivateFileOrQueue } from "@/features/documents/storage-cleanup";
import { createAdminClient } from "@/lib/supabase/admin";

type DeliverableTable =
  | "city_model_district_files"
  | "stakeholder_interview_reports"
  | "futures_research_reports";

// knowledge_files.file_id has no ON DELETE action, so a files-row delete with a
// surviving RAG reference raises an FK violation mid-flow. Clear the RAG rows
// first (knowledge_chunks cascade off knowledge_files), which also stops the
// vector search from serving content whose source file is gone.
async function clearRagReferences(fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("knowledge_files")
    .delete()
    .in("file_id", fileIds);
  if (error) throw error;
}

// Fully removes a file record: RAG references → files row → storage object
// (queued for retry if storage is unavailable). Used for detached deliverables
// and for old files left behind when a deliverable is re-uploaded.
export async function removeFileRecordAndStorage({
  fileId,
  reason,
}: {
  fileId: string;
  reason: "ADMIN_FILE_DELETED" | "REVIEW_DELIVERABLE_REPLACED";
}): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select("id, storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { id: string; storage_path: string } | null;
  if (!row) return;

  await clearRagReferences([row.id]);

  const { error: deleteError } = await admin
    .from("files")
    .delete()
    .eq("id", row.id);
  if (deleteError) throw deleteError;

  await removePrivateFileOrQueue({
    storagePath: row.storage_path,
    fileId: row.id,
    reason,
  });
}

// Removes the uploaded file from a review deliverable and resets the row back to
// PENDING_UPLOAD, then deletes the file record and its storage object. Mirrors
// the upload flow in reverse. Safe to call when nothing is attached (no-op).
//
// `also` clears extra file columns (e.g. a futures-research storyline) in the
// same reset; their storage is cleaned up too.
export async function detachDeliverableFile({
  table,
  match,
  fileColumns = ["file_id"],
}: {
  table: DeliverableTable;
  match: Record<string, string>;
  fileColumns?: string[];
}): Promise<{ removed: boolean }> {
  const admin = createAdminClient();

  let selectQuery = admin.from(table).select(fileColumns.join(", ")).limit(1);
  for (const [key, value] of Object.entries(match)) {
    selectQuery = selectQuery.eq(key, value);
  }
  const { data: row, error: selectError } = await selectQuery.maybeSingle();
  if (selectError) throw selectError;

  const rowRecord = (row ?? {}) as Record<string, string | null>;
  const fileIds = fileColumns
    .map((column) => rowRecord[column])
    .filter((id): id is string => Boolean(id));
  if (fileIds.length === 0) {
    return { removed: false };
  }

  // Resolve storage paths before deleting the file rows.
  const { data: files, error: filesError } = await admin
    .from("files")
    .select("id, storage_path")
    .in("id", fileIds);
  if (filesError) throw filesError;

  // Reset the deliverable row (clears the FK references + status).
  const resetPatch: Record<string, unknown> = {
    status: "PENDING_UPLOAD",
    uploaded_at: null,
    approved_at: null,
    approved_by: null,
    updated_at: new Date().toISOString(),
  };
  for (const column of fileColumns) {
    resetPatch[column] = null;
  }
  let updateQuery = admin.from(table).update(resetPatch);
  for (const [key, value] of Object.entries(match)) {
    updateQuery = updateQuery.eq(key, value);
  }
  const { error: updateError } = await updateQuery;
  if (updateError) throw updateError;

  // Clear RAG references first (knowledge_files has a non-cascading FK), then
  // delete the file rows and remove (or queue) their storage objects.
  await clearRagReferences(fileIds);

  const { error: deleteError } = await admin
    .from("files")
    .delete()
    .in("id", fileIds);
  if (deleteError) throw deleteError;

  for (const file of (files ?? []) as Array<{
    id: string;
    storage_path: string;
  }>) {
    await removePrivateFileOrQueue({
      storagePath: file.storage_path,
      fileId: file.id,
      reason: "ADMIN_FILE_DELETED",
    });
  }

  return { removed: true };
}
