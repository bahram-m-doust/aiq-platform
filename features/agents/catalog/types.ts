export type CatalogAgentKey =
  | "STORY_TELLER"
  | "IMAGE_GENERATOR"
  | "VIDEO_GENERATOR"
  | "CAMPAIGN_MAKER"
  | "BRAND_DIGITAL_ACTIVATION"
  | "AVATAR"
  | "DETAIL_DESIGN"
  | "SECURE_CHAT"
  | "BEXLOGIX";

export type CatalogAgentDisplayState =
  | "LOCKED_BY_PLAN"
  | "LOCKED_BY_BRAIN"
  | "AVAILABLE"
  | "ACTIVE"
  | "SUSPENDED";

export type AgentCatalogAccess = {
  brandId: string;
  brandName: string;
  membershipRole: string;
  planName: string | null;
};

export type AgentCatalogItem = {
  key: CatalogAgentKey;
  slug: string;
  name: string;
  description: string;
  agentId: string | null;
  entitlementId: string | null;
  entitlementStatus: string | null;
  displayState: CatalogAgentDisplayState;
  isActivatable: boolean;
  stateMessage: string;
  activatedAt: string | null;
};

export type AgentCatalogWorkspace = {
  access: AgentCatalogAccess;
  brainReady: boolean;
  brainReadinessMessage: string;
  agents: AgentCatalogItem[];
};

export type AgentActivationFormState = {
  status: "idle" | "error" | "success";
  message: string;
  agentKey?: CatalogAgentKey;
};

