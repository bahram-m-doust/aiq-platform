import type { CatalogAgentKey } from "@/features/agents/catalog/types";

export type AgentRunSource = {
  fileName: string;
  score: number | null;
};

export type AgentRunRetrievedSource = AgentRunSource & {
  providerFileId: string | null;
  attributes: Record<string, string | number | boolean> | null;
};

export type AgentRunFormState = {
  status: "idle" | "error" | "success";
  message: string;
  answer?: string;
  sources?: AgentRunSource[];
  runId?: string;
  agentKey?: CatalogAgentKey;
  imagePaths?: string[];
};

export type AgentRunHistoryItem = {
  id: string;
  agentId: string;
  brandId: string;
  userId: string | null;
  promptExcerpt: string;
  answerExcerpt: string;
  model: string | null;
  sources: AgentRunSource[];
  createdAt: string | null;
};

export type AgentRunResult = {
  runId: string;
  answer: string;
  sources: AgentRunSource[];
  model: string;
  imagePaths?: string[];
};

export type AgentKnowledgeModuleScope = {
  requiredModuleTypes: string[];
  filteredModuleIds: string[];
  filter:
    | {
        key: "module_id";
        type: "eq" | "in";
        value: string | string[];
      }
    | null;
};

