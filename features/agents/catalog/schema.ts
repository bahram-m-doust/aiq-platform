import type {
  AgentActivationFormState,
  AgentCatalogItem,
  CatalogAgentDisplayState,
  CatalogAgentKey,
} from "@/features/agents/catalog/types";

export const catalogAgentDefinitions = [
  {
    key: "IMAGE_GENERATOR",
    slug: "image-generator",
    name: "Image Generator",
    description:
      "Visual exploration support for approved brand directions.",
  },
  {
    key: "VIDEO_GENERATOR",
    slug: "video-generator",
    name: "Video Generator",
    description:
      "Video concepting support for brand communication and activation.",
  },
  {
    key: "CAMPAIGN_MAKER",
    slug: "campaign-maker",
    name: "Campaign Maker",
    description:
      "Campaign structure support for translating strategy into market action.",
  },
  {
    key: "BRAND_DIGITAL_ACTIVATION",
    slug: "brand-digital-activation",
    name: "Brand Digital Twin",
    description:
      "Digital activation support for applying the Brand Brain across channels.",
  },
  {
    key: "STORY_TELLER",
    slug: "story-teller",
    name: "Story Teller",
    description:
      "Narrative development support for strategic brand storytelling.",
  },
  {
    key: "AVATAR",
    slug: "avatar",
    name: "Avatar",
    description: "Brand avatar support for on-brand persona generation.",
  },
  {
    key: "DETAIL_DESIGN",
    slug: "detail-design",
    name: "Detail Design",
    description: "Detailed design support for refining brand assets.",
  },
  {
    key: "SECURE_CHAT",
    slug: "secure-chat",
    name: "Secure chat",
    description: "Private, secure conversational support for your brand.",
  },
  {
    key: "BEXLOGIX",
    slug: "bexlogix",
    name: "BexLogix",
    description: "Operational logistics support for brand activation.",
  },
] as const satisfies readonly {
  key: CatalogAgentKey;
  slug: string;
  name: string;
  description: string;
}[];

export const catalogAgentKeys = catalogAgentDefinitions.map(
  (agent) => agent.key,
);

export const initialAgentActivationFormState: AgentActivationFormState = {
  status: "idle",
  message: "",
};

export const agentDisplayStateLabels: Record<CatalogAgentDisplayState, string> =
  {
    LOCKED_BY_PLAN: "Locked by plan",
    LOCKED_BY_BRAIN: "Locked by Brain",
    AVAILABLE: "Available",
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
  };

export function canActivateAgentRole(role: string | null | undefined) {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function isCatalogAgentKey(value: string): value is CatalogAgentKey {
  return catalogAgentDefinitions.some((agent) => agent.key === value);
}

export function catalogAgentKeyFromRoute(value: string) {
  const normalized = value.trim().toUpperCase().replace(/-/g, "_");
  return isCatalogAgentKey(normalized) ? normalized : null;
}

export function catalogAgentDefinitionForKey(key: CatalogAgentKey) {
  return catalogAgentDefinitions.find((agent) => agent.key === key) ?? null;
}

export function catalogAgentSlugForKey(key: CatalogAgentKey) {
  return catalogAgentDefinitionForKey(key)?.slug ?? key.toLowerCase();
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function validateAgentActivationFormData(formData: FormData): {
  agentKey: CatalogAgentKey | null;
  error: string | null;
} {
  const agentKey = catalogAgentKeyFromRoute(formString(formData, "agent_key"));

  if (!agentKey) {
    return { agentKey: null, error: "Choose a valid agent to activate." };
  }

  return { agentKey, error: null };
}

export function deriveAgentDisplayState({
  entitlementStatus,
  brainReady,
}: {
  entitlementStatus: string | null;
  brainReady: boolean;
}): Pick<
  AgentCatalogItem,
  "displayState" | "isActivatable" | "stateMessage"
> {
  if (!entitlementStatus || entitlementStatus === "LOCKED_BY_PLAN") {
    return {
      displayState: "LOCKED_BY_PLAN",
      isActivatable: false,
      stateMessage: "This agent is not included in the current plan.",
    };
  }

  if (entitlementStatus === "ACTIVE") {
    return {
      displayState: "ACTIVE",
      isActivatable: false,
      stateMessage: "This agent is active for the current brand.",
    };
  }

  if (entitlementStatus === "SUSPENDED") {
    return {
      displayState: "SUSPENDED",
      isActivatable: false,
      stateMessage: "This agent is currently suspended.",
    };
  }

  if (!brainReady) {
    return {
      displayState: "LOCKED_BY_BRAIN",
      isActivatable: false,
      stateMessage: "Brand Brain must be ready before this agent can activate.",
    };
  }

  if (
    entitlementStatus === "LOCKED_BY_BRAIN" ||
    entitlementStatus === "AVAILABLE"
  ) {
    return {
      displayState: "AVAILABLE",
      isActivatable: true,
      stateMessage: "This agent is available for Owner activation.",
    };
  }

  return {
    displayState: "LOCKED_BY_PLAN",
    isActivatable: false,
    stateMessage: "This agent is not available for the current brand.",
  };
}

export function toAgentActivatedAuditMetadata({
  brandId,
  agentId,
  agentKey,
  oldStatus,
  actorId,
}: {
  brandId: string;
  agentId: string;
  agentKey: CatalogAgentKey;
  oldStatus: string;
  actorId: string;
}) {
  return {
    brand_id: brandId,
    agent_id: agentId,
    agent_key: agentKey,
    old_status: oldStatus,
    new_status: "ACTIVE",
    actor_id: actorId,
  };
}

