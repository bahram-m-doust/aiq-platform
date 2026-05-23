import "server-only";

import { isPlatformOwnerProfile } from "@/features/auth/roles";
import type { UserProfile } from "@/features/auth/types";
import { downloadPrivateFile } from "@/features/files/storage";
import {
  createOpenAIFileSearchVectorStore,
  hasOpenAIFileSearchEnv,
  uploadOpenAIFileToVectorStore,
} from "@/features/rag/openai";
import { getRagApprovedFilesForSync } from "@/features/rag/queries";
import { toRagSyncAuditMetadata } from "@/features/rag/schema";
import type { RagApprovedSyncFile, RagSyncResult } from "@/features/rag/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
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
    .eq("provider", "OPENAI_FILE_SEARCH")
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
      provider: "OPENAI_FILE_SEARCH",
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
  providerVectorStoreId,
}: {
  id: string;
  status: string;
  providerVectorStoreId?: string | null;
}) {
  const admin = createAdminClient();
  const update: Record<string, string | null> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (providerVectorStoreId !== undefined) {
    update.provider_vector_store_id = providerVectorStoreId;
  }

  const { data, error } = await admin
    .from("knowledge_bases")
    .update(update)
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
    .eq("rag_status", "RAG_APPROVED")
    .in("id", knowledgeFileIds(files));

  if (error) {
    throw error;
  }

  return files;
}

async function updateKnowledgeFileSyncResult({
  file,
  status,
  providerFileId,
}: {
  file: RagApprovedSyncFile;
  status: "RAG_SYNCED" | "SYNC_FAILED";
  providerFileId?: string | null;
}) {
  const admin = createAdminClient();
  const update: Record<string, string | null> = {
    rag_status: status,
  };

  if (providerFileId) {
    update.provider_file_id = providerFileId;
  }

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

async function ensureProviderVectorStore({
  brand,
  knowledgeBase,
}: {
  brand: BrandRow;
  knowledgeBase: KnowledgeBaseRow;
}) {
  if (knowledgeBase.provider_vector_store_id) {
    return knowledgeBase;
  }

  const vectorStore = await createOpenAIFileSearchVectorStore({
    brandId: brand.id,
    brandName: brand.name,
  });

  return updateKnowledgeBase({
    id: knowledgeBase.id,
    status: "SYNCING",
    providerVectorStoreId: vectorStore.providerVectorStoreId,
  });
}

async function syncOneFile({
  file,
  providerVectorStoreId,
}: {
  file: RagApprovedSyncFile;
  providerVectorStoreId: string;
}) {
  const blob = await downloadPrivateFile(file.storagePath);
  const upload = await uploadOpenAIFileToVectorStore({
    providerVectorStoreId,
    fileBytes: await blob.arrayBuffer(),
    fileName: file.originalName,
    mimeType: file.mimeType,
    attributes: {
      brand_id: file.brandId,
      knowledge_file_id: file.knowledgeFileId,
      module_id: file.moduleId ?? "",
      artifact_id: file.artifactId,
      file_id: file.fileId,
    },
  });

  if (upload.status !== "completed") {
    await updateKnowledgeFileSyncResult({
      file,
      status: "SYNC_FAILED",
      providerFileId: upload.providerFileId,
    });

    return { ok: false, file };
  }

  await updateKnowledgeFileSyncResult({
    file,
    status: "RAG_SYNCED",
    providerFileId: upload.providerFileId,
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

  if (!hasOpenAIFileSearchEnv()) {
    ragSyncError("OPENAI_API_KEY is required before RAG sync can run.");
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

  try {
    knowledgeBase = await ensureProviderVectorStore({ brand, knowledgeBase });
  } catch (error) {
    knowledgeBase = await updateKnowledgeBase({
      id: knowledgeBase.id,
      status: "SYNC_FAILED",
    });
    await insertRagSyncAudit({
      actor: triggeredBy,
      brandId: brand.id,
      knowledgeBase,
      action: "rag_sync_completed",
      oldStatus: "SYNCING",
      newStatus: "SYNC_FAILED",
      attemptedFiles: files,
      syncedFiles: [],
      failedFiles: files,
    });
    throw error;
  }

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
      const result = await syncOneFile({
        file,
        providerVectorStoreId:
          knowledgeBase.provider_vector_store_id ??
          ragSyncError("OpenAI vector store id was not stored."),
      });

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
      knowledgeBase.provider_vector_store_id ??
      ragSyncError("OpenAI vector store id was not stored."),
    attemptedCount: markedFiles.length,
    syncedCount: syncedFiles.length,
    failedCount: failedFiles.length,
  };
}
