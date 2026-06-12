import "server-only";

import { isPlatformOwnerProfile } from "@/features/auth/roles";
import type { UserProfile } from "@/features/auth/types";
import { hasEmbeddingEnv } from "@/features/rag/embeddings";
import { syncFileToChunks } from "@/features/rag/pgvector-sync";
import { getRagApprovedFilesForSync } from "@/features/rag/queries";
import {
  ragRetryableSyncStatuses,
  toRagSyncAuditMetadata,
} from "@/features/rag/schema";
import type { RagApprovedSyncFile, RagSyncResult } from "@/features/rag/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const RAG_PROVIDER = "PGVECTOR";

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

async function getOrCreateKnowledgeBase(brandId: string) {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("knowledge_bases")
    .select("id, brand_id, provider, provider_vector_store_id, status")
    .eq("brand_id", brandId)
    .eq("provider", RAG_PROVIDER)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing as KnowledgeBaseRow;
  }

  const { data, error } = await admin
    .from("knowledge_bases")
    .insert({
      brand_id: brandId,
      provider: RAG_PROVIDER,
      provider_vector_store_id: `pgvector:${brandId}`,
      status: "NOT_READY",
    })
    .select("id, brand_id, provider, provider_vector_store_id, status")
    .single();

  if (error) {
    throw error;
  }

  return data as KnowledgeBaseRow;
}

async function updateKnowledgeBase({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_bases")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, brand_id, provider, provider_vector_store_id, status")
    .single();

  if (error) {
    throw error;
  }

  return data as KnowledgeBaseRow;
}

async function markFilesSyncing({
  brandId,
  files,
}: {
  brandId: string;
  files: RagApprovedSyncFile[];
}) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("knowledge_files")
    .update({ rag_status: "SYNCING" })
    .eq("brand_id", brandId)
    .in("rag_status", [...ragRetryableSyncStatuses])
    .in("id", knowledgeFileIds(files));

  if (error) {
    throw error;
  }

  return files;
}

async function updateKnowledgeFileSyncResult({
  file,
  status,
}: {
  file: RagApprovedSyncFile;
  status: "RAG_SYNCED" | "SYNC_FAILED";
}) {
  const admin = createAdminClient();
  const update: Record<string, string | null> = {
    rag_status: status,
    provider_file_id: `pgvector:${file.knowledgeFileId}`,
  };

  if (status === "RAG_SYNCED") {
    update.synced_at = new Date().toISOString();
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
    providerVectorStoreId: knowledgeBase.provider_vector_store_id,
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

async function syncOneFile(file: RagApprovedSyncFile) {
  const result = await syncFileToChunks(file);

  if (!result.ok) {
    await updateKnowledgeFileSyncResult({ file, status: "SYNC_FAILED" });
    return { ok: false, file };
  }

  await updateKnowledgeFileSyncResult({ file, status: "RAG_SYNCED" });
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
    ragSyncError("Only Platform Owners can trigger RAG sync.");
  }

  const brand = await getBrand(brandId);

  if (!brand) {
    ragSyncError("Brand could not be found for RAG sync.");
  }

  const files = await getRagApprovedFilesForSync({ brandId });

  if (files.length === 0) {
    ragSyncError("No RAG_APPROVED files are ready to sync for this brand.");
  }

  if (!hasEmbeddingEnv()) {
    ragSyncError("OPENROUTER_API_KEY is required for generating embeddings.");
  }

  const initialKnowledgeBase = await getOrCreateKnowledgeBase(brand.id);
  let knowledgeBase = await updateKnowledgeBase({
    id: initialKnowledgeBase.id,
    status: "SYNCING",
  });

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
    knowledgeBase = await updateKnowledgeBase({
      id: knowledgeBase.id,
      status: initialKnowledgeBase.status ?? "NOT_READY",
    });
    ragSyncError("No RAG_APPROVED files remained eligible for sync.");
  }

  const syncedFiles: RagApprovedSyncFile[] = [];
  const failedFiles: RagApprovedSyncFile[] = [];

  for (const file of markedFiles) {
    try {
      const result = await syncOneFile(file);

      if (result.ok) {
        syncedFiles.push(file);
      } else {
        failedFiles.push(file);
      }
    } catch {
      await updateKnowledgeFileSyncResult({
        file,
        status: "SYNC_FAILED",
      });
      failedFiles.push(file);
    }
  }

  const finalStatus = failedFiles.length > 0 ? "SYNC_FAILED" : "RAG_SYNCED";
  knowledgeBase = await updateKnowledgeBase({
    id: knowledgeBase.id,
    status: finalStatus,
  });

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
      knowledgeBase.provider_vector_store_id ?? `pgvector:${brand.id}`,
    attemptedCount: markedFiles.length,
    syncedCount: syncedFiles.length,
    failedCount: failedFiles.length,
  };
}
