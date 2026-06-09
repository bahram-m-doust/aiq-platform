export type BrandBrainRole = "OWNER" | "EXECUTIVE_MANAGER";

export type BrandBrainChatRole = "user" | "assistant";

export type BrandBrainChatMessage = {
  role: BrandBrainChatRole;
  content: string;
};

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

// A persisted turn rehydrated from agent_runs so the conversation survives a
// page reload. User turns carry no sources; assistant turns carry the sources
// that grounded the original answer. Image turns additionally carry signed image
// URLs and the optimized prompt that produced them.
export type BrandBrainConversationMessage = {
  id: string;
  role: BrandBrainChatRole;
  content: string;
  sources: BrandBrainDisplaySource[] | null;
  images?: string[] | null;
  imagePrompt?: string | null;
};

export type BrandBrainImageRunResult = {
  runId: string;
  optimizedPrompt: string;
  images: string[];
  sources: BrandBrainDisplaySource[];
};

// Return shape of the image-mode server action (imperatively called from the
// chat client; image generation completes in one shot, it is not streamed).
export type BrandBrainImageState =
  | { status: "success"; runId: string; images: string[]; imagePrompt: string; sources: BrandBrainDisplaySource[] }
  | { status: "error"; message: string };

// NDJSON protocol streamed from the Brand Brain route to the chat client: token
// deltas, then a terminal event carrying the persisted run id and its sources,
// or an error.
export type BrandBrainStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; runId: string; sources: BrandBrainDisplaySource[] }
  | { type: "error"; message: string };
