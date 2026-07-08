import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/openai/client", () => ({
  getOpenAIClient: vi.fn(),
}));

vi.mock("@/features/documents/storage", () => ({
  downloadPrivateFile: vi.fn(),
}));

import {
  cleanupKnowledgeFileByFileId,
  getOrCreateOpenAIVectorStore,
} from "@/features/rag/openai-file-search";
import { getOpenAIClient } from "@/lib/openai/client";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedGetOpenAIClient = vi.mocked(getOpenAIClient);

describe("OpenAI File Search cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not send legacy pgvector provider ids to OpenAI cleanup", async () => {
    const selectBuilder = {
      select: vi.fn(() => selectBuilder),
      eq: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "knowledge-1",
              brand_id: "brand-1",
              file_id: "file-1",
              provider_file_id: "pgvector:knowledge-1",
              openai_file_id: null,
              openai_vector_store_file_id: null,
            },
          ],
          error: null,
        }),
      ),
    };
    const updateBuilder = {
      update: vi.fn(() => updateBuilder),
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(selectBuilder)
      .mockReturnValueOnce(updateBuilder);
    const vectorStoreFileDelete = vi.fn();
    const fileDelete = vi.fn();

    mockedCreateAdminClient.mockReturnValue({ from } as never);
    mockedGetOpenAIClient.mockResolvedValue({
      vectorStores: { files: { delete: vectorStoreFileDelete } },
      files: { delete: fileDelete },
    } as never);

    await cleanupKnowledgeFileByFileId("file-1");

    expect(vectorStoreFileDelete).not.toHaveBeenCalled();
    expect(fileDelete).not.toHaveBeenCalled();
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_file_id: null,
        openai_file_id: null,
        openai_vector_store_file_id: null,
      }),
    );
  });

  it("replaces stale vector stores that belong to a previous OpenAI key project", async () => {
    const existingKnowledgeBaseBuilder = {
      select: vi.fn(() => existingKnowledgeBaseBuilder),
      eq: vi.fn(() => existingKnowledgeBaseBuilder),
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: {
            id: "kb-1",
            brand_id: "brand-1",
            provider: "OPENAI_FILE_SEARCH",
            provider_vector_store_id: "vs_old",
            status: "RAG_SYNCED",
            openai_vector_store_id: "vs_old",
            openai_vector_store_status: "completed",
            openai_vector_store_created_at: "2026-01-01T00:00:00.000Z",
          },
          error: null,
        }),
      ),
    };
    const knowledgeBaseResetBuilder = {
      update: vi.fn(() => knowledgeBaseResetBuilder),
      eq: vi.fn(() => knowledgeBaseResetBuilder),
    };
    const knowledgeFilesResetBuilder = {
      update: vi.fn(() => knowledgeFilesResetBuilder),
      eq: vi.fn(() => knowledgeFilesResetBuilder),
      in: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    const insertKnowledgeBaseBuilder = {
      upsert: vi.fn(() => insertKnowledgeBaseBuilder),
      select: vi.fn(() => insertKnowledgeBaseBuilder),
      single: vi.fn(() =>
        Promise.resolve({
          data: {
            id: "kb-1",
            brand_id: "brand-1",
            provider: "OPENAI_FILE_SEARCH",
            provider_vector_store_id: "vs_new",
            status: "NOT_READY",
            openai_vector_store_id: "vs_new",
            openai_vector_store_status: "completed",
            openai_vector_store_created_at: "2026-02-01T00:00:00.000Z",
          },
          error: null,
        }),
      ),
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(existingKnowledgeBaseBuilder)
      .mockReturnValueOnce(knowledgeBaseResetBuilder)
      .mockReturnValueOnce(knowledgeFilesResetBuilder)
      .mockReturnValueOnce(insertKnowledgeBaseBuilder);
    const retrieve = vi.fn(() => {
      const error = new Error("Vector store vs_old not found.");
      (error as Error & { status: number }).status = 404;
      return Promise.reject(error);
    });
    const create = vi.fn(() =>
      Promise.resolve({
        id: "vs_new",
        status: "completed",
        created_at: 1767225600,
      }),
    );

    mockedCreateAdminClient.mockReturnValue({ from } as never);
    mockedGetOpenAIClient.mockResolvedValue({
      vectorStores: { retrieve, create },
    } as never);

    const result = await getOrCreateOpenAIVectorStore({
      brandId: "brand-1",
      brandName: "Helio",
    });

    expect(retrieve).toHaveBeenCalledWith("vs_old");
    expect(knowledgeBaseResetBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_vector_store_id: null,
        status: "NOT_READY",
        openai_vector_store_id: null,
      }),
    );
    expect(knowledgeFilesResetBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        rag_status: "RAG_APPROVED",
        openai_file_id: null,
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "aiq-brand-brand-1" }),
    );
    expect(result.openai_vector_store_id).toBe("vs_new");
  });
});
