import type {
  AgentKnowledgeModuleScope,
  AgentRunFormState,
  AgentRunRetrievedSource,
  AgentRunSource,
} from "@/features/agents/runs/types";
import type { CatalogAgentKey } from "@/features/agents/catalog/types";

export const initialAgentRunFormState: AgentRunFormState = {
  status: "idle",
  message: "",
};

export const agentRunPromptMaxLength = 2000;
export const agentRunProvider = "OPENROUTER";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function validateAgentRunFormData(
  formData: FormData,
  parseAgentKey: (value: string) => CatalogAgentKey | null,
): {
  agentKey: CatalogAgentKey | null;
  prompt: string | null;
  error: string | null;
} {
  const agentKey = parseAgentKey(formString(formData, "agent_key"));
  const prompt = formString(formData, "prompt");

  if (!agentKey) {
    return { agentKey: null, prompt: null, error: "Choose a valid agent." };
  }

  if (!prompt) {
    return { agentKey, prompt: null, error: "Enter a request for this agent." };
  }

  if (prompt.length > agentRunPromptMaxLength) {
    return {
      agentKey,
      prompt: null,
      error: `Keep the request under ${agentRunPromptMaxLength} characters.`,
    };
  }

  return { agentKey, prompt, error: null };
}

// Agent images are stored at `${brandId}/${runId}/${index}.png`, so the first
// path segment is the owning brand. Only paths whose first segment matches the
// caller's brand may be signed — otherwise an authenticated user could mint
// signed URLs for another brand's private images by passing arbitrary paths
// (cross-tenant IDOR). Returns at most `limit` owned paths.
export function filterOwnedAgentImagePaths(
  imagePaths: string[],
  brandId: string | null,
  limit = 8,
): string[] {
  if (!brandId) {
    return [];
  }

  return imagePaths
    .filter((path) => path.split("/")[0] === brandId)
    .slice(0, limit);
}

export function parseRequiredModuleTypes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function buildAgentKnowledgeModuleScope({
  requiredModuleTypes,
  syncedModuleIds,
}: {
  requiredModuleTypes: string[];
  syncedModuleIds: string[];
}): AgentKnowledgeModuleScope {
  const filteredModuleIds = Array.from(new Set(syncedModuleIds));

  if (requiredModuleTypes.length === 0) {
    return {
      requiredModuleTypes,
      filteredModuleIds: [],
      filter: null,
    };
  }

  if (filteredModuleIds.length === 1) {
    return {
      requiredModuleTypes,
      filteredModuleIds,
      filter: {
        key: "module_id",
        type: "eq",
        value: filteredModuleIds[0],
      },
    };
  }

  return {
    requiredModuleTypes,
    filteredModuleIds,
    filter: {
      key: "module_id",
      type: "in",
      value: filteredModuleIds,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSafeFileName(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : "Knowledge file";
}

function toSafeScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toSafeProviderFileId(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : null;
}

function toSafeAttributes(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return Object.entries(value).reduce<Record<string, string | number | boolean>>(
    (attributes, [key, attributeValue]) => {
      if (
        typeof attributeValue === "string" ||
        typeof attributeValue === "number" ||
        typeof attributeValue === "boolean"
      ) {
        attributes[key.slice(0, 64)] =
          typeof attributeValue === "string"
            ? attributeValue.slice(0, 512)
            : attributeValue;
      }

      return attributes;
    },
    {},
  );
}

export function extractAgentRunSources(response: unknown) {
  if (!isRecord(response) || !Array.isArray(response.output)) {
    return [];
  }

  const sourcesByKey = new Map<string, AgentRunRetrievedSource>();

  response.output.forEach((item) => {
    if (!isRecord(item) || item.type !== "file_search_call") {
      return;
    }

    const results = Array.isArray(item.results) ? item.results : [];

    results.forEach((result) => {
      if (!isRecord(result)) {
        return;
      }

      const providerFileId = toSafeProviderFileId(result.file_id);
      const fileName = toSafeFileName(result.filename);
      const key = providerFileId ?? fileName;

      if (!sourcesByKey.has(key)) {
        sourcesByKey.set(key, {
          fileName,
          score: toSafeScore(result.score),
          providerFileId,
          attributes: toSafeAttributes(result.attributes),
        });
      }
    });
  });

  return Array.from(sourcesByKey.values()).slice(0, 10);
}

export function toAgentRunDisplaySources(sources: AgentRunRetrievedSource[]) {
  return sources.map<AgentRunSource>(({ fileName, score }) => ({
    fileName,
    score,
  }));
}

export function extractPromptExcerpt(value: unknown) {
  if (!isRecord(value) || typeof value.prompt !== "string") {
    return "Prompt not recorded";
  }

  return value.prompt.trim().slice(0, 180) || "Prompt not recorded";
}

export function extractAnswerExcerpt(value: unknown) {
  if (!isRecord(value) || typeof value.answer !== "string") {
    return "Answer not recorded";
  }

  return value.answer.trim().slice(0, 240) || "Answer not recorded";
}

export function extractHistorySources(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap<AgentRunSource>((source) => {
    if (!isRecord(source)) {
      return [];
    }

    return [
      {
        fileName: toSafeFileName(source.fileName),
        score: toSafeScore(source.score),
      },
    ];
  });
}

export function toAgentRunAuditMetadata({
  brandId,
  agentId,
  agentKey,
  runId,
  userId,
  model,
}: {
  brandId: string;
  agentId: string;
  agentKey: CatalogAgentKey;
  runId: string;
  userId: string;
  model: string;
}) {
  return {
    brand_id: brandId,
    agent_id: agentId,
    agent_key: agentKey,
    run_id: runId,
    user_id: userId,
    model,
  };
}

