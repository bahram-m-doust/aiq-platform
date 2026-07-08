import "server-only";

import { isPlatformOwnerProfile } from "@/features/auth/roles";
import type { UserProfile } from "@/features/auth/types";
import {
  getOrCreateOpenAIVectorStore,
  sanitizeOpenAIError,
  updateOpenAIKnowledgeBaseStatus,
  uploadFileToOpenAIFileSearch,
} from "@/features/rag/openai-file-search";
import { getRagApprovedFilesForSync } from "@/features/rag/queries";
import {
  ragOpenAISyncCandidateStatuses,
  toRagSyncAuditMetadata,
} from "@/features/rag/schema";
import type { RagApprovedSyncFile, RagSyncResult } from "@/features/rag/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { hasOpenAIKey } from "@/lib/openai/client";
import { createAdminClient } from "@/lib/supabase/admin";

type BrandRow = {
  id: string;
  name: string;
};

type KnowledgeBaseRow = {
  id: string;
  brand_id: string;
  provider: string;
  provider_vector_store_id: string | null;
  status: string | null;
  openai_vector_store_id: string | null;
  openai_vector_store_status: string | null;
  openai_vector_store_created_at: string | null;
};

const CODE = "rag_sync";

export function isRagSyncServiceError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}
function ragSyncError(message: string): never {
  throw new DomainError(CODE, message);
}

function knowledgeFileIds(files: Pick<RagApprovedSyncFile, "knowledgeFileId">[]) {
  return files.map((file) => file.knowledgeFileId);
}

async function getBrand(brandId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as BrandRow | null;
}

async function markFilesSyncing({
  brandId,
  files,
}: {
  brandId: string;
  files: RagApprovedSyncFile[];
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_files")
    .update({
      rag_status: "SYNCING",
      openai_sync_status: "SYNCING",
      openai_sync_error: null,
    })
    .eq("brand_id", brandId)
    .in("rag_status", [...ragOpenAISyncCandidateStatuses])
    .in("id", knowledgeFileIds(files))
    .select("id");

  if (error) {
    throw error;
  }

  const transitionedIds = new Set(
    ((data ?? []) as { id: string }[]).map((row) => row.id),
  );
  return files.filter((file) => transitionedIds.has(file.knowledgeFileId));
}

async function updateKnowledgeFileSyncResult({
  file,
  status,
  openaiFileId,
  vectorStoreFileId,
  errorMessage,
}: {
  file: RagApprovedSyncFile;
  status: "RAG_SYNCED" | "SYNC_FAILED";
  openaiFileId?: string | null;
  vectorStoreFileId?: string | null;
  errorMessage?: string | null;
}) {
  const admin = createAdminClient();
  const update: Record<string, string | null> = {
    rag_status: status,
    openai_sync_status: status,
    openai_sync_error:
      status === "SYNC_FAILED" ? (errorMessage ?? "OpenAI sync failed.") : null,
  };

  if (status === "RAG_SYNCED") {
    const now = new Date().toISOString();
    update.provider_file_id = openaiFileId ?? null;
    update.openai_file_id = openaiFileId ?? null;
    update.openai_vector_store_file_id =
      vectorStoreFileId ?? openaiFileId ?? null;
    update.synced_at = now;
    update.openai_synced_at = now;
  }

  const { error } = await admin
    .from("knowledge_files")
    .update(update)
    .eq("id", file.knowledgeFileId)
    .eq("brand_id", file.brandId)
    .eq("file_id", file.fileId)
    .eq("rag_status", "SYNCING");

  if (error) {
    throw error;
  }
}

async function insertRagSyncAudit({
  actor,
  brandId,
  knowledgeBase,
  action,
  oldStatus,
  newStatus,
  attemptedFiles,
  syncedFiles,
  failedFiles,
}: {
  actor: UserProfile;
  brandId: string;
  knowledgeBase: KnowledgeBaseRow;
  action: "rag_sync_started" | "rag_sync_completed";
  oldStatus: string;
  newStatus: string;
  attemptedFiles: RagApprovedSyncFile[];
  syncedFiles: RagApprovedSyncFile[];
  failedFiles: RagApprovedSyncFile[];
}) {
  const metadata = toRagSyncAuditMetadata({
    brandId,
    providerVectorStoreId:
      knowledgeBase.openai_vector_store_id ??
      knowledgeBase.provider_vector_store_id,
    actorId: actor.id,
    attemptedKnowledgeFileIds: knowledgeFileIds(attemptedFiles),
    syncedKnowledgeFileIds: knowledgeFileIds(syncedFiles),
    failedKnowledgeFileIds: knowledgeFileIds(failedFiles),
    oldStatus,
    newStatus,
  });
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId,
    action,
    entityType: "knowledge_base",
    entityId: knowledgeBase.id,
    before: { ...metadata, new_status: oldStatus },
    after: metadata,
  });
}

async function syncOneFile({
  file,
  vectorStoreId,
}: {
  file: RagApprovedSyncFile;
  vectorStoreId: string;
}) {
  const result = await uploadFileToOpenAIFileSearch({ file, vectorStoreId });
  await updateKnowledgeFileSyncResult({
    file,
    status: "RAG_SYNCED",
    openaiFileId: result.openaiFileId,
    vectorStoreFileId: result.vectorStoreFileId,
  });
  return { ok: true, file };
}

export async function syncBrandKnowledgeBase({
  brandId,
  triggeredBy,
}: {
  brandId: string;
  triggeredBy: UserProfile;
}): Promise<RagSyncResult> {
  if (!isPlatformOwnerProfile(triggeredBy)) {
    ragSyncError("Only Platform Owners can trigger OpenAI File Search sync.");
  }

  const brand = await getBrand(brandId);

  if (!brand) {
    ragSyncError("Brand could not be found for OpenAI File Search sync.");
  }

  if (!(await hasOpenAIKey())) {
    ragSyncError("OpenAI API key is required for OpenAI File Search sync.");
  }

  // Resolve the vector store before loading sync candidates. If the stored
  // vector_store_id belongs to a previous OpenAI project/key, this call resets
  // local OpenAI mappings so previously synced files become eligible for a
  // clean rebuild under the current key.
  const initialKnowledgeBase = (await getOrCreateOpenAIVectorStore({
    brandId: brand.id,
    brandName: brand.name,
  })) as KnowledgeBaseRow;
  const vectorStoreId =
    initialKnowledgeBase.openai_vector_store_id ??
    initialKnowledgeBase.provider_vector_store_id;

  if (!vectorStoreId) {
    ragSyncError("OpenAI vector store could not be created for this brand.");
  }

  const files = await getRagApprovedFilesForSync({ brandId });

  if (files.length === 0) {
    ragSyncError("No Brain-approved files are ready to sync for this brand.");
  }

  let knowledgeBase = (await updateOpenAIKnowledgeBaseStatus({
    knowledgeBaseId: initialKnowledgeBase.id,
    providerVectorStoreId: vectorStoreId,
    status: "SYNCING",
    openaiStatus: "in_progress",
  })) as KnowledgeBaseRow;

  await insertRagSyncAudit({
    actor: triggeredBy,
    brandId: brand.id,
    knowledgeBase,
    action: "rag_sync_started",
    oldStatus: initialKnowledgeBase.status ?? "NOT_READY",
    newStatus: "SYNCING",
    attemptedFiles: files,
    syncedFiles: [],
    failedFiles: [],
  });

  const markedFiles = await markFilesSyncing({ brandId: brand.id, files });

  if (markedFiles.length === 0) {
    knowledgeBase = (await updateOpenAIKnowledgeBaseStatus({
      knowledgeBaseId: knowledgeBase.id,
      providerVectorStoreId: vectorStoreId,
      status: initialKnowledgeBase.status ?? "NOT_READY",
      openaiStatus:
        initialKnowledgeBase.openai_vector_store_status ?? "not_ready",
    })) as KnowledgeBaseRow;
    ragSyncError("No Brain-approved files remained eligible for sync.");
  }

  const syncedFiles: RagApprovedSyncFile[] = [];
  const failedFiles: RagApprovedSyncFile[] = [];

  for (const file of markedFiles) {
    try {
      const result = await syncOneFile({ file, vectorStoreId });

      if (result.ok) {
        syncedFiles.push(file);
      } else {
        failedFiles.push(file);
      }
    } catch (error) {
      await updateKnowledgeFileSyncResult({
        file,
        status: "SYNC_FAILED",
        errorMessage: sanitizeOpenAIError(error),
      });
      failedFiles.push(file);
    }
  }

  const finalStatus = failedFiles.length > 0 ? "SYNC_FAILED" : "RAG_SYNCED";
  knowledgeBase = (await updateOpenAIKnowledgeBaseStatus({
    knowledgeBaseId: knowledgeBase.id,
    providerVectorStoreId: vectorStoreId,
    status: finalStatus,
    openaiStatus: "completed",
  })) as KnowledgeBaseRow;

  await insertRagSyncAudit({
    actor: triggeredBy,
    brandId: brand.id,
    knowledgeBase,
    action: "rag_sync_completed",
    oldStatus: "SYNCING",
    newStatus: finalStatus,
    attemptedFiles: markedFiles,
    syncedFiles,
    failedFiles,
  });

  return {
    brandId: brand.id,
    providerVectorStoreId:
      knowledgeBase.openai_vector_store_id ??
      knowledgeBase.provider_vector_store_id ??
      vectorStoreId,
    attemptedCount: markedFiles.length,
    syncedCount: syncedFiles.length,
    failedCount: failedFiles.length,
  };
}
