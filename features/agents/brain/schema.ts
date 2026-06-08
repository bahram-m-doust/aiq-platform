import type {
  BrandBrainChatFormState,
  BrandBrainChatMessage,
  BrandBrainReadiness,
  BrandBrainReadinessStatus,
  BrandBrainRetrievedSource,
  BrandBrainRole,
} from "@/features/agents/brain/types";
import type { BrandAccessSummary } from "@/features/access/types";

export const brandBrainAgentKey = "BRAND_INTEGRATOR_BRAIN";
export const brandBrainProvider = "OPENROUTER";
export const brandBrainPromptMaxLength = 2000;

// Conversation memory window. The client sends prior turns with each request so
// follow-up questions ("expand on that") stay coherent; we cap how many turns
// reach the model to bound token cost and keep retrieval focused on the latest
// question.
export const brandBrainHistoryMaxMessages = 10;

export const initialBrandBrainChatFormState: BrandBrainChatFormState = {
  status: "idle",
  message: "",
};

const readinessMessages: Record<BrandBrainReadinessStatus, string> = {
  NO_ACTIVE_ACCESS:
    "Brand Brain is locked until this account has active brand access.",
  ROLE_NOT_ALLOWED:
    "Brand Brain is available to Owners and Executive Managers only.",
  AGENT_UNAVAILABLE:
    "Brand Brain configuration is not complete. Contact Bextudio support.",
  KNOWLEDGE_BASE_NOT_SYNCED:
    "Brand Brain is locked until the current brand knowledge base has completed RAG sync.",
  NO_SYNCED_FILES:
    "Brand Brain is locked until at least one RAG-approved brand file has been synced.",
  READY: "Brand Brain is ready.",
};

export const readinessLabels: Record<BrandBrainReadinessStatus, string> = {
  NO_ACTIVE_ACCESS: "No active access",
  ROLE_NOT_ALLOWED: "Role restricted",
  AGENT_UNAVAILABLE: "Agent unavailable",
  KNOWLEDGE_BASE_NOT_SYNCED: "Awaiting RAG sync",
  NO_SYNCED_FILES: "No synced files",
  READY: "Ready",
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function canUseBrandBrainRole(
  role: string | null | undefined,
): role is BrandBrainRole {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

function validatePromptString(prompt: string): {
  prompt: string | null;
  error: string | null;
} {
  if (!prompt) {
    return { prompt: null, error: "Enter a question for Brand Brain." };
  }

  if (prompt.length > brandBrainPromptMaxLength) {
    return {
      prompt: null,
      error: `Keep the question under ${brandBrainPromptMaxLength} characters.`,
    };
  }

  return { prompt, error: null };
}

export function validateBrandBrainPromptFormData(formData: FormData): {
  prompt: string | null;
  error: string | null;
} {
  return validatePromptString(readString(formData, "prompt"));
}

// JSON-body equivalent used by the streaming route handler.
export function validateBrandBrainPrompt(value: unknown): {
  prompt: string | null;
  error: string | null;
} {
  return validatePromptString(typeof value === "string" ? value.trim() : "");
}

function toChatMessage(value: unknown): BrandBrainChatMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const role = value.role;
  const content = typeof value.content === "string" ? value.content.trim() : "";

  if ((role !== "user" && role !== "assistant") || !content) {
    return null;
  }

  return { role, content: content.slice(0, brandBrainPromptMaxLength) };
}

// History arrives as untrusted input from the browser; normalize defensively and
// cap it to the memory window so a crafted payload can't balloon the model
// context.
export function normalizeBrandBrainHistory(
  value: unknown,
): BrandBrainChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const messages = value
    .map(toChatMessage)
    .filter((message): message is BrandBrainChatMessage => message !== null);

  return messages.slice(-brandBrainHistoryMaxMessages);
}

export function parseBrandBrainHistory(
  formData: FormData,
): BrandBrainChatMessage[] {
  const raw = formData.get("history");

  if (typeof raw !== "string" || !raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  return normalizeBrandBrainHistory(parsed);
}

function readiness({
  status,
  knowledgeBaseId = null,
  providerVectorStoreId = null,
  syncedFileCount = 0,
}: {
  status: BrandBrainReadinessStatus;
  knowledgeBaseId?: string | null;
  providerVectorStoreId?: string | null;
  syncedFileCount?: number;
}): BrandBrainReadiness {
  return {
    isReady: status === "READY",
    status,
    message: readinessMessages[status],
    knowledgeBaseId,
    providerVectorStoreId,
    syncedFileCount,
  };
}

export function resolveBrandBrainReadiness({
  accessSummary,
  hasAgent,
  knowledgeBaseId,
  knowledgeBaseStatus,
  providerVectorStoreId,
  syncedFileCount,
}: {
  accessSummary: Pick<
    BrandAccessSummary,
    "status" | "brandId" | "membershipRole"
  >;
  hasAgent: boolean;
  knowledgeBaseId: string | null;
  knowledgeBaseStatus: string | null;
  providerVectorStoreId: string | null;
  syncedFileCount: number;
}) {
  if (accessSummary.status !== "ACTIVE_ACCESS" || !accessSummary.brandId) {
    return readiness({ status: "NO_ACTIVE_ACCESS" });
  }

  if (!canUseBrandBrainRole(accessSummary.membershipRole)) {
    return readiness({ status: "ROLE_NOT_ALLOWED" });
  }

  if (!hasAgent) {
    return readiness({ status: "AGENT_UNAVAILABLE" });
  }

  if (knowledgeBaseStatus !== "RAG_SYNCED") {
    return readiness({
      status: "KNOWLEDGE_BASE_NOT_SYNCED",
      knowledgeBaseId,
      providerVectorStoreId,
      syncedFileCount,
    });
  }

  if (syncedFileCount <= 0) {
    return readiness({
      status: "NO_SYNCED_FILES",
      knowledgeBaseId,
      providerVectorStoreId,
      syncedFileCount,
    });
  }

  return readiness({
    status: "READY",
    knowledgeBaseId,
    providerVectorStoreId,
    syncedFileCount,
  });
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

export function extractBrandBrainSources(response: unknown) {
  if (!isRecord(response) || !Array.isArray(response.output)) {
    return [];
  }

  const sourcesByKey = new Map<string, BrandBrainRetrievedSource>();

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

export function toBrandBrainDisplaySources(
  sources: BrandBrainRetrievedSource[],
) {
  return sources.map(({ fileName, score }) => ({ fileName, score }));
}

export function toAgentRunAuditMetadata({
  brandId,
  agentId,
  runId,
  userId,
  model,
}: {
  brandId: string;
  agentId: string;
  runId: string;
  userId: string;
  model: string;
}) {
  return {
    brand_id: brandId,
    agent_id: agentId,
    run_id: runId,
    user_id: userId,
    model,
  };
}
