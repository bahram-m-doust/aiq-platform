import "server-only";

import { removePrivateFileOrQueue } from "@/features/documents/storage-cleanup";
import { createAdminClient } from "@/lib/supabase/admin";

type DeliverableTable =
  | "city_model_district_files"
  | "stakeholder_interview_reports"
  | "futures_research_reports";

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

  // Delete the file rows, then remove (or queue) their storage objects.
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
