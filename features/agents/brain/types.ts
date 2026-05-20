export type BrandBrainRole = "OWNER" | "EXECUTIVE_MANAGER";

export type BrandBrainAccess = {
  brandId: string;
  brandName: string;
  membershipRole: string;
  planName: string | null;
};

export type BrandBrainReadinessStatus =
  | "NO_ACTIVE_ACCESS"
  | "ROLE_NOT_ALLOWED"
  | "AGENT_UNAVAILABLE"
  | "KNOWLEDGE_BASE_NOT_SYNCED"
  | "NO_SYNCED_FILES"
  | "READY";

export type BrandBrainReadiness = {
  isReady: boolean;
  status: BrandBrainReadinessStatus;
  message: string;
  knowledgeBaseId: string | null;
  providerVectorStoreId: string | null;
  syncedFileCount: number;
};

export type BrandBrainAgent = {
  id: string;
  key: "BRAND_INTEGRATOR_BRAIN";
  name: string;
};

export type BrandBrainWorkspace = {
  access: BrandBrainAccess | null;
  readiness: BrandBrainReadiness;
  agent: BrandBrainAgent | null;
};

export type BrandBrainDisplaySource = {
  fileName: string;
  score: number | null;
};

export type BrandBrainRetrievedSource = BrandBrainDisplaySource & {
  providerFileId: string | null;
  attributes: Record<string, string | number | boolean> | null;
};

export type BrandBrainRunResult = {
  runId: string;
  answer: string;
  sources: BrandBrainDisplaySource[];
  model: string;
};

export type BrandBrainChatFormState = {
  status: "idle" | "error" | "success";
  message: string;
  answer?: string;
  sources?: BrandBrainDisplaySource[];
  runId?: string;
};
