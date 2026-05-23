import "server-only";

import OpenAI, { toFile } from "openai";

import { readTrimmedRuntimeEnv } from "@/lib/env/runtime";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";

let openaiClient: OpenAI | null = null;

const CODE = "openai_file_search_config";

export function isOpenAIFileSearchConfigError(
  error: unknown,
): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

export function hasOpenAIFileSearchEnv() {
  return Boolean(readTrimmedRuntimeEnv("OPENAI_API_KEY"));
}

function getOpenAIClient() {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = readTrimmedRuntimeEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new DomainError(
      CODE,
      "OPENAI_API_KEY is required before RAG sync can run.",
    );
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export async function createOpenAIFileSearchVectorStore({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const client = getOpenAIClient();
  const vectorStore = await client.vectorStores.create({
    name: `Bextudio Brand Brain - ${brandName}`,
    description: "Bextudio MVP brand-isolated File Search vector store.",
    metadata: {
      brand_id: brandId,
      product: "bextudio-platform",
      scope: "brand_brain_mvp",
    },
  });

  return {
    providerVectorStoreId: vectorStore.id,
    status: vectorStore.status,
  };
}

export async function uploadOpenAIFileToVectorStore({
  providerVectorStoreId,
  fileBytes,
  fileName,
  mimeType,
  attributes,
}: {
  providerVectorStoreId: string;
  fileBytes: ArrayBuffer;
  fileName: string;
  mimeType: string | null;
  attributes: Record<string, string>;
}) {
  const client = getOpenAIClient();
  const file = await toFile(Buffer.from(fileBytes), fileName, {
    type: mimeType ?? "application/pdf",
  });
  const uploaded = await client.files.create({
    file,
    purpose: "assistants",
  });
  const vectorStoreFile = await client.vectorStores.files.createAndPoll(
    providerVectorStoreId,
    {
      file_id: uploaded.id,
      attributes,
    },
  );

  return {
    providerFileId: uploaded.id,
    vectorStoreFileId: vectorStoreFile.id,
    status: vectorStoreFile.status,
    errorMessage: vectorStoreFile.last_error?.message ?? null,
  };
}
