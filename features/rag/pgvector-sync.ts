import "server-only";

import { downloadPrivateFile } from "@/features/documents/storage";
import { chunkMarkdown, chunkText } from "@/features/rag/chunker";
import { embedTexts } from "@/features/rag/embeddings";
import { extractTextFromFile } from "@/features/rag/text-extractor";
import type { RagApprovedSyncFile } from "@/features/rag/types";
import {
  getCachedMarkdown,
  setCachedMarkdown,
} from "@/features/review-content/markdown-cache";
import {
  hasMarkdownGenerationEnv,
  structureTextAsMarkdown,
} from "@/features/review-content/pdf-to-markdown";
import { createAdminClient } from "@/lib/supabase/admin";

function isMarkdownFile(file: RagApprovedSyncFile): boolean {
  const mime = (file.mimeType ?? "").toLowerCase();
  if (mime.includes("markdown")) return true;
  const name = (file.originalName ?? "").toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown");
}

// Resolves the best text to chunk for RAG, preferring heading-structured
// markdown so chunks split on real sections:
//   1. cached LLM-generated markdown for this file,
//   2. a `.md` upload (verbatim),
//   3. a fresh LLM pass over extracted PDF/docx text (cached for next time),
//   4. raw extracted text (no headings).
// Returns { text, isMarkdown }.
async function resolveRagText(
  file: RagApprovedSyncFile,
  buffer: Buffer,
): Promise<{ text: string; isMarkdown: boolean }> {
  const cached = await getCachedMarkdown(file.fileId);
  if (cached?.markdown.trim()) {
    return { text: cached.markdown.trim(), isMarkdown: true };
  }

  if (isMarkdownFile(file)) {
    return { text: buffer.toString("utf-8").trim(), isMarkdown: true };
  }

  const rawText = (await extractTextFromFile(buffer, file.mimeType)).trim();
  if (rawText && hasMarkdownGenerationEnv()) {
    try {
      const markdown = await structureTextAsMarkdown({
        rawText,
        brandId: file.brandId,
      });
      if (markdown.trim()) {
        await setCachedMarkdown({
          fileId: file.fileId,
          subjectType: file.moduleId ? "MODULE" : "BRAND_DOC",
          subjectId: file.moduleId ?? file.fileId,
          markdown,
        });
        return { text: markdown.trim(), isMarkdown: true };
      }
    } catch {
      // Fall through to raw text on LLM failure.
    }
  }

  return { text: rawText, isMarkdown: false };
}

export async function syncFileToChunks(
  file: RagApprovedSyncFile,
): Promise<{ ok: boolean; chunkCount: number; error?: string }> {
  const blob = await downloadPrivateFile(file.storagePath);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const { text, isMarkdown } = await resolveRagText(file, buffer);

  if (!text.trim()) {
    return { ok: false, chunkCount: 0, error: "No text extracted from file." };
  }

  // Heading-aware chunking when we have markdown (cached/generated/.md), so each
  // RAG chunk lines up with a document section (the same unit comments anchor
  // to). Other formats fall back to recursive text chunking.
  const chunks = isMarkdown ? chunkMarkdown(text) : chunkText(text);

  if (chunks.length === 0) {
    return { ok: false, chunkCount: 0, error: "Chunking produced no chunks." };
  }

  const embeddings = await embedTexts(chunks.map((c) => c.text), file.brandId);

  const admin = createAdminClient();

  const rows = chunks.map((chunk, i) => ({
    chunk_index: chunk.index,
    chunk_text: chunk.text,
    token_count: chunk.tokenCount,
    embedding: embeddings[i],
  }));

  const { data: replacedCount, error: replaceError } = await admin.rpc(
    "replace_knowledge_chunks",
    {
      p_knowledge_file_id: file.knowledgeFileId,
      p_brand_id: file.brandId,
      p_module_id: file.moduleId ?? null,
      p_rows: rows,
    },
  );

  if (replaceError) throw replaceError;
  if (Number(replacedCount) !== rows.length) {
    throw new Error("Knowledge chunk replacement returned an unexpected count.");
  }

  return { ok: true, chunkCount: chunks.length };
}
