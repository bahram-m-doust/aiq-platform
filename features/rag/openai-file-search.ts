import "server-only";

import { toFile } from "openai";

import { downloadPrivateFile } from "@/features/documents/storage";
import type {
  BrandBrainRetrievedSource,
} from "@/features/agents/brain/types";
import type { RagApprovedSyncFile } from "@/features/rag/types";
import { buildUntrustedKnowledgeContext } from "@/features/rag/prompt-context";
import { getOpenAIClient } from "@/lib/openai/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const OPENAI_FILE_SEARCH_PROVIDER = "OPENAI_FILE_SEARCH";

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

type KnowledgeFileCleanupRow = {
  id: string;
  brand_id: string;
  file_id: string | null;
  provider_file_id: string | null;
  openai_file_id: string | null;
  openai_vector_store_file_id: string | null;
};

type VectorSearchRow = {
  chunkText: string;
  fileName: string;
  score: number;
  providerFileId: string | null;
  attributes: Record<string, string | number | boolean> | null;
};

const knowledgeBaseColumns = [
  "id",
  "brand_id",
  "provider",
  "provider_vector_store_id",
  "status",
  "openai_vector_store_id",
  "openai_vector_store_status",
  "openai_vector_store_created_at",
].join(", ");

export function sanitizeOpenAIError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "OpenAI request failed.";

  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/https?:\/\/\S+/g, "[redacted-url]")
    .slice(0, 500);
}

function isoFromUnixSeconds(value: number | null | undefined): string | null {
  return typeof value === "number"
    ? new Date(value * 1000).toISOString()
    : null;
}

export async function getOpenAIKnowledgeBase(
  brandId: string,
): Promise<KnowledgeBaseRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_bases")
    .select(knowledgeBaseColumns)
    .eq("brand_id", brandId)
    .eq("provider", OPENAI_FILE_SEARCH_PROVIDER)
    .maybeSingle();

  if (error) throw error;
  return data as KnowledgeBaseRow | null;
}

export async function getBrandOpenAIVectorStore({
  brandId,
}: {
  brandId: string;
}) {
  const knowledgeBase = await getOpenAIKnowledgeBase(brandId);
  const vectorStoreId =
    knowledgeBase?.openai_vector_store_id ??
    knowledgeBase?.provider_vector_store_id ??
    null;

  if (!knowledgeBase || !vectorStoreId) {
    return null;
  }

  return {
    knowledgeBaseId: knowledgeBase.id,
    vectorStoreId,
    status:
      knowledgeBase.openai_vector_store_status ??
      knowledgeBase.status ??
      "NOT_READY",
  };
}

export async function resetOpenAIFileSearchMappingsForBrand({
  brandId,
}: {
  brandId: string;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error: knowledgeBaseError } = await admin
    .from("knowledge_bases")
    .update({
      provider_vector_store_id: null,
      status: "NOT_READY",
      openai_vector_store_id: null,
      openai_vector_store_status: "not_ready",
      openai_vector_store_created_at: null,
      updated_at: now,
    })
    .eq("brand_id", brandId)
    .eq("provider", OPENAI_FILE_SEARCH_PROVIDER);

  if (knowledgeBaseError) throw knowledgeBaseError;

  const { error: knowledgeFilesError } = await admin
    .from("knowledge_files")
    .update({
      rag_status: "RAG_APPROVED",
      provider_file_id: null,
      openai_file_id: null,
      openai_vector_store_file_id: null,
      openai_sync_status: null,
      openai_synced_at: null,
      openai_sync_error: null,
      synced_at: null,
    })
    .eq("brand_id", brandId)
    .in("rag_status", ["SYNCING", "RAG_SYNCED", "SYNC_FAILED"]);

  if (knowledgeFilesError) throw knowledgeFilesError;
}

async function insertKnowledgeBaseForVectorStore({
  brandId,
  vectorStoreId,
  status,
  createdAt,
}: {
  brandId: string;
  vectorStoreId: string;
  status: string;
  createdAt: string | null;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("knowledge_bases")
    .upsert(
      {
        brand_id: brandId,
        provider: OPENAI_FILE_SEARCH_PROVIDER,
        provider_vector_store_id: vectorStoreId,
        status: "NOT_READY",
        openai_vector_store_id: vectorStoreId,
        openai_vector_store_status: status,
        openai_vector_store_created_at: createdAt,
        updated_at: now,
      },
      { onConflict: "brand_id, provider" },
    )
    .select(knowledgeBaseColumns)
    .single();

  if (error) throw error;
  return data as unknown as KnowledgeBaseRow;
}

export async function getOrCreateOpenAIVectorStore({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}): Promise<KnowledgeBaseRow> {
  const existing = await getOpenAIKnowledgeBase(brandId);
  const existingVectorStoreId =
    existing?.openai_vector_store_id ?? existing?.provider_vector_store_id;
  const client = await getOpenAIClient();

  if (existing && existingVectorStoreId) {
    try {
      await client.vectorStores.retrieve(existingVectorStoreId);
      return existing;
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      await resetOpenAIFileSearchMappingsForBrand({ brandId });
    }
  }

  const vectorStore = await client.vectorStores.create({
    name: `aiq-brand-${brandId}`,
    description: `AIQ Brand Brain knowledge store for ${brandName}`,
    metadata: {
      brand_id: brandId,
      source: "aiq-platform",
    },
  });

  return insertKnowledgeBaseForVectorStore({
    brandId,
    vectorStoreId: vectorStore.id,
    status: vectorStore.status,
    createdAt: isoFromUnixSeconds(vectorStore.created_at),
  });
}

export async function updateOpenAIKnowledgeBaseStatus({
  knowledgeBaseId,
  providerVectorStoreId,
  status,
  openaiStatus,
}: {
  knowledgeBaseId: string;
  providerVectorStoreId: string;
  status: string;
  openaiStatus?: string | null;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_bases")
    .update({
      provider_vector_store_id: providerVectorStoreId,
      openai_vector_store_id: providerVectorStoreId,
      openai_vector_store_status: openaiStatus ?? status,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", knowledgeBaseId)
    .select(knowledgeBaseColumns)
    .single();

  if (error) throw error;
  return data as unknown as KnowledgeBaseRow;
}

export async function uploadFileToOpenAIFileSearch({
  file,
  vectorStoreId,
}: {
  file: RagApprovedSyncFile;
  vectorStoreId: string;
}) {
  const client = await getOpenAIClient();
  const blob = await downloadPrivateFile(file.storagePath);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const uploadable = await toFile(buffer, file.originalName, {
    type: file.mimeType ?? "application/octet-stream",
  });

  const openAIFile = await client.files.create({
    file: uploadable,
    purpose: "assistants",
  });

  try {
    const vectorFile = await client.vectorStores.files.createAndPoll(
      vectorStoreId,
      {
        file_id: openAIFile.id,
        attributes: {
          brand_id: file.brandId,
          file_id: file.fileId,
          knowledge_file_id: file.knowledgeFileId,
          module_id: file.moduleId ?? "",
        },
      },
      { pollIntervalMs: 2000 },
    );

    if (vectorFile.status !== "completed") {
      throw new Error(
        vectorFile.last_error?.message ??
          `OpenAI vector store file ended with ${vectorFile.status}.`,
      );
    }

    return {
      openaiFileId: openAIFile.id,
      vectorStoreFileId: vectorFile.id,
      vectorStoreFileStatus: vectorFile.status,
    };
  } catch (error) {
    await client.files.delete(openAIFile.id).catch(() => undefined);
    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: unknown }).status;
  const message = error instanceof Error ? error.message : "";
  return status === 404 || /not found|no such/i.test(message);
}

export async function cleanupOpenAIKnowledgeFileIds({
  vectorStoreId,
  openaiFileId,
}: {
  vectorStoreId: string | null;
  openaiFileId: string | null;
}) {
  if (!openaiFileId) return;

  const client = await getOpenAIClient();

  if (vectorStoreId) {
    try {
      await client.vectorStores.files.delete(openaiFileId, {
        vector_store_id: vectorStoreId,
      });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  }

  try {
    await client.files.delete(openaiFileId);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }
}

function resolveOpenAIFileIdForCleanup(row: KnowledgeFileCleanupRow) {
  if (row.openai_file_id) {
    return row.openai_file_id;
  }

  // Legacy pgvector rows stored values like "pgvector:<knowledge_file_id>" in
  // provider_file_id. Never send those to OpenAI cleanup APIs.
  return row.provider_file_id && /^file[-_]/.test(row.provider_file_id)
    ? row.provider_file_id
    : null;
}

export async function cleanupKnowledgeFileByFileId(
  fileId: string,
  { deleteLedger = false }: { deleteLedger?: boolean } = {},
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_files")
    .select(
      "id, brand_id, file_id, provider_file_id, openai_file_id, openai_vector_store_file_id",
    )
    .eq("file_id", fileId);

  if (error) throw error;

  const rows = (data ?? []) as KnowledgeFileCleanupRow[];

  for (const row of rows) {
    const openaiFileId = resolveOpenAIFileIdForCleanup(row);
    if (!openaiFileId) {
      continue;
    }

    const vectorStore = await getBrandOpenAIVectorStore({
      brandId: row.brand_id,
    });
    await cleanupOpenAIKnowledgeFileIds({
      vectorStoreId: vectorStore?.vectorStoreId ?? null,
      openaiFileId,
    });
  }

  if (rows.length > 0 && deleteLedger) {
    const { error: deleteError } = await admin
      .from("knowledge_files")
      .delete()
      .eq("file_id", fileId);

    if (deleteError) throw deleteError;
    return;
  }

  if (rows.length > 0) {
    const { error: updateError } = await admin
      .from("knowledge_files")
      .update({
        provider_file_id: null,
        openai_file_id: null,
        openai_vector_store_file_id: null,
        openai_sync_status: null,
        openai_synced_at: null,
        openai_sync_error: null,
        synced_at: null,
      })
      .eq("file_id", fileId);

    if (updateError) throw updateError;
  }
}

function toVectorSearchRows(response: unknown): VectorSearchRow[] {
  const data =
    response && typeof response === "object" && Array.isArray((response as { data?: unknown }).data)
      ? (response as { data: unknown[] }).data
      : [];

  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as {
      content?: unknown;
      filename?: unknown;
      file_id?: unknown;
      score?: unknown;
      attributes?: unknown;
    };
    const content = Array.isArray(row.content)
      ? row.content
          .map((part) =>
            part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
              ? (part as { text: string }).text
              : "",
          )
          .filter(Boolean)
          .join("\n\n")
      : "";

    if (!content.trim()) return [];

    return [
      {
        chunkText: content.trim(),
        fileName:
          typeof row.filename === "string" && row.filename.trim()
            ? row.filename.trim()
            : "Knowledge file",
        score:
          typeof row.score === "number" && Number.isFinite(row.score)
            ? row.score
            : 0,
        providerFileId:
          typeof row.file_id === "string" && row.file_id.trim()
            ? row.file_id.trim()
            : null,
        attributes:
          row.attributes && typeof row.attributes === "object"
            ? (row.attributes as Record<string, string | number | boolean>)
            : null,
      },
    ];
  });
}

export async function searchOpenAIBrandKnowledge({
  brandId,
  query,
  topK = 5,
}: {
  brandId: string;
  query: string;
  topK?: number;
}) {
  const vectorStore = await getBrandOpenAIVectorStore({ brandId });
  if (!vectorStore?.vectorStoreId) {
    return {
      context: "",
      retrievedSources: [] as BrandBrainRetrievedSource[],
      displaySources: [] as { fileName: string; score: number | null }[],
    };
  }

  const client = await getOpenAIClient();
  const response = await client.vectorStores.search(vectorStore.vectorStoreId, {
    query,
    max_num_results: Math.max(1, Math.min(20, topK)),
  });
  const rows = toVectorSearchRows(response);

  const retrievedSources: BrandBrainRetrievedSource[] = rows.map((row) => ({
    fileName: row.fileName,
    score: row.score,
    providerFileId: row.providerFileId,
    attributes: row.attributes,
  }));

  return {
    context: buildUntrustedKnowledgeContext(rows),
    retrievedSources,
    displaySources: retrievedSources.map(({ fileName, score }) => ({
      fileName,
      score,
    })),
  };
}
