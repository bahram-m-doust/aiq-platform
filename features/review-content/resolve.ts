import "server-only";

import { downloadPrivateFile } from "@/features/documents/storage";
import {
  getCachedMarkdown,
  setCachedMarkdown,
} from "@/features/review-content/markdown-cache";
import {
  hasMarkdownGenerationEnv,
  structureTextAsMarkdown,
} from "@/features/review-content/pdf-to-markdown";
import { extractTextFromFile } from "@/features/rag/text-extractor";
import { logServerError } from "@/lib/logging/server";

function isMarkdownFile(mimeType: string | null, name: string | null): boolean {
  if (mimeType && mimeType.toLowerCase().includes("markdown")) return true;
  const lower = (name ?? "").toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

// Resolves the markdown a deliverable should render. Order of preference:
//   1. Markdown cached for this file (LLM-structured READY, or RAW backfill).
//   2. A `.md` upload (the format the brand skills emit) — used verbatim.
//   3. Live text extraction from docx/pdf/txt (no headings — legacy fallback);
//      the result is backfilled into the cache as RAW so the whole file is
//      downloaded and parsed at most once, not on every page view.
// Returns null when there is no file or the type can't be extracted.
export async function resolveDeliverableMarkdown({
  fileId,
  storagePath,
  mimeType,
  originalName,
}: {
  fileId?: string | null;
  storagePath: string;
  mimeType: string | null;
  originalName: string | null;
}): Promise<string | null> {
  try {
    if (fileId) {
      const cached = await getCachedMarkdown(fileId);
      if (cached?.markdown.trim()) return cached.markdown.trim();
    }

    const blob = await downloadPrivateFile(storagePath);
    const buffer = Buffer.from(await blob.arrayBuffer());
    if (isMarkdownFile(mimeType, originalName)) {
      return buffer.toString("utf-8").trim();
    }
    const text = (await extractTextFromFile(buffer, mimeType)).trim();
    if (text && fileId) {
      // RAW (not READY): the RAG sync still upgrades it to LLM-structured
      // markdown; the viewer just stops re-extracting on every request.
      await setCachedMarkdown({
        fileId,
        subjectType: null,
        subjectId: null,
        markdown: text,
        status: "RAW",
      });
    }
    return text;
  } catch {
    return null;
  }
}

// Extracts a deliverable's text and, for non-markdown sources, restructures it
// into clean Markdown with headings via the LLM, then caches it by file. Safe to
// call after an upload — failures are logged but never throw (the viewer falls
// back to live extraction). Skipped silently when OpenRouter isn't configured.
export async function generateAndCacheDeliverableMarkdown({
  fileId,
  brandId,
  subjectType,
  subjectId,
  storagePath,
  mimeType,
  originalName,
}: {
  fileId: string;
  brandId: string;
  subjectType: string;
  subjectId: string;
  storagePath: string;
  mimeType: string | null;
  originalName: string | null;
}): Promise<void> {
  try {
    const blob = await downloadPrivateFile(storagePath);
    const buffer = Buffer.from(await blob.arrayBuffer());

    // A `.md` upload is already structured — cache it as-is.
    if (isMarkdownFile(mimeType, originalName)) {
      const markdown = buffer.toString("utf-8").trim();
      if (markdown) {
        await setCachedMarkdown({ fileId, subjectType, subjectId, markdown });
      }
      return;
    }

    const rawText = (await extractTextFromFile(buffer, mimeType)).trim();
    if (!rawText) return;

    if (!hasMarkdownGenerationEnv()) {
      // No LLM configured: cache the raw text so the viewer still renders it.
      await setCachedMarkdown({
        fileId,
        subjectType,
        subjectId,
        markdown: rawText,
        status: "READY",
      });
      return;
    }

    const markdown = await structureTextAsMarkdown({ rawText, brandId });
    await setCachedMarkdown({
      fileId,
      subjectType,
      subjectId,
      markdown: markdown || rawText,
    });
  } catch (error) {
    logServerError({
      label: "[review-content] markdown generation failed",
      error,
      metadata: { fileId, subjectType, subjectId },
    });
  }
}
