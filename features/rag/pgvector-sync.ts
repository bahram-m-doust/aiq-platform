import "server-only";

import { downloadPrivateFile } from "@/features/documents/storage";
import { chunkText } from "@/features/rag/chunker";
import { embedTexts } from "@/features/rag/embeddings";
import { extractTextFromFile } from "@/features/rag/text-extractor";
import type { RagApprovedSyncFile } from "@/features/rag/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function syncFileToChunks(
  file: RagApprovedSyncFile,
): Promise<{ ok: boolean; chunkCount: number; error?: string }> {
  const blob = await downloadPrivateFile(file.storagePath);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const text = await extractTextFromFile(buffer, file.mimeType);

  if (!text.trim()) {
    return { ok: false, chunkCount: 0, error: "No text extracted from file." };
  }

  const chunks = chunkText(text);

  if (chunks.length === 0) {
    return { ok: false, chunkCount: 0, error: "Chunking produced no chunks." };
  }

  const embeddings = await embedTexts(chunks.map((c) => c.text), file.brandId);

  const admin = createAdminClient();

  await admin
    .from("knowledge_chunks")
    .delete()
    .eq("knowledge_file_id", file.knowledgeFileId);

  const rows = chunks.map((chunk, i) => ({
    knowledge_file_id: file.knowledgeFileId,
    brand_id: file.brandId,
    module_id: file.moduleId ?? null,
    chunk_index: chunk.index,
    chunk_text: chunk.text,
    token_count: chunk.tokenCount,
    embedding: JSON.stringify(embeddings[i]),
  }));

  const { error: insertError } = await admin
    .from("knowledge_chunks")
    .insert(rows);

  if (insertError) throw insertError;

  return { ok: true, chunkCount: chunks.length };
}
