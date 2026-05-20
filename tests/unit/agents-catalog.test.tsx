import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/agents/catalog/actions", () => ({
  activateAgentAction: vi.fn(),
  initialAgentActivationFormState: { status: "idle", message: "" },
}));

vi.mock("@/features/agents/runs/actions", () => ({
  runAgentAction: vi.fn(),
  initialAgentRunFormState: { status: "idle", message: "" },
}));

vi.mock("@/features/agents/catalog/queries", () => ({
  getAgentCatalogWorkspace: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentCatalogList } from "@/features/agents/catalog/components/AgentCatalogList";
import { AgentDetail } from "@/features/agents/catalog/components/AgentDetail";
import {
  canActivateAgentRole,
  catalogAgentKeyFromRoute,
  deriveAgentDisplayState,
  toAgentActivatedAuditMetadata,
  validateAgentActivationFormData,
} from "@/features/agents/catalog/schema";
import {
  activateCatalogAgent,
  isAgentActivationServiceError,
} from "@/features/agents/catalog/services";
import type { UserProfile } from "@/features/auth/types";
import type {
  AgentCatalogItem,
  AgentCatalogWorkspace,
} from "@/features/agents/catalog/types";

const mockedGetAgentCatalogWorkspace = vi.mocked(getAgentCatalogWorkspace);
const mockedCreateAdminClient = vi.mocked(createAdminClient);

function formData(values: Record<string, string>) {
  const data = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    data.set(key, value);
  });

  return data;
}

function profile(): UserProfile {
  return {
    id: "profile-1",
    auth_user_id: "auth-1",
    email: "owner@example.com",
    full_name: null,
    global_role: "REGISTERED_USER",
  };
}

function catalogAgent(
  overrides: Partial<AgentCatalogItem> = {},
): AgentCatalogItem {
  return {
    key: "STORY_TELLER",
    slug: "story-teller",
    name: "Story Teller",
    description: "Narrative development support.",
    agentId: "agent-1",
    entitlementId: "entitlement-1",
    entitlementStatus: "LOCKED_BY_BRAIN",
    displayState: "AVAILABLE",
    isActivatable: true,
    stateMessage: "This agent is available for Owner activation.",
    activatedAt: null,
    ...overrides,
  };
}

function workspace(
  overrides: Partial<AgentCatalogWorkspace> = {},
): AgentCatalogWorkspace {
  return {
    access: {
      brandId: "brand-1",
      brandName: "Helio",
      membershipRole: "OWNER",
      planName: "ADVANCED",
    },
    brainReady: true,
    brainReadinessMessage: "Brand Brain is ready.",
    agents: [catalogAgent()],
    ...overrides,
  };
}

describe("Agent catalog rules", () => {
  it("normalizes catalog keys from route params and form values", () => {
    expect(catalogAgentKeyFromRoute("story-teller")).toBe("STORY_TELLER");
    expect(catalogAgentKeyFromRoute("STORY_TELLER")).toBe("STORY_TELLER");
    expect(catalogAgentKeyFromRoute("unknown-agent")).toBeNull();
    expect(
      validateAgentActivationFormData(
        formData({ agent_key: " brand-digital-activation " }),
      ).agentKey,
    ).toBe("BRAND_DIGITAL_ACTIVATION");
  });

  it("allows Owner and Executive Manager activation only", () => {
    expect(canActivateAgentRole("OWNER")).toBe(true);
    expect(canActivateAgentRole("EXECUTIVE_MANAGER")).toBe(true);
    expect(canActivateAgentRole("BRAND_SPECIALIST")).toBe(false);
    expect(canActivateAgentRole(null)).toBe(false);
  });

  it("derives locked, available, active, and suspended display states", () => {
    expect(
      deriveAgentDisplayState({
        entitlementStatus: null,
        brainReady: true,
      }).displayState,
    ).toBe("LOCKED_BY_PLAN");
    expect(
      deriveAgentDisplayState({
        entitlementStatus: "LOCKED_BY_BRAIN",
        brainReady: false,
      }).displayState,
    ).toBe("LOCKED_BY_BRAIN");
    expect(
      deriveAgentDisplayState({
        entitlementStatus: "LOCKED_BY_BRAIN",
        brainReady: true,
      }),
    ).toMatchObject({ displayState: "AVAILABLE", isActivatable: true });
    expect(
      deriveAgentDisplayState({
        entitlementStatus: "ACTIVE",
        brainReady: true,
      }).displayState,
    ).toBe("ACTIVE");
    expect(
      deriveAgentDisplayState({
        entitlementStatus: "SUSPENDED",
        brainReady: true,
      }).displayState,
    ).toBe("SUSPENDED");
  });

  it("builds safe activation audit metadata", () => {
    const audit = toAgentActivatedAuditMetadata({
      brandId: "brand-1",
      agentId: "agent-1",
      agentKey: "STORY_TELLER",
      oldStatus: "LOCKED_BY_BRAIN",
      actorId: "profile-1",
    });
    const auditJson = JSON.stringify(audit);

    expect(audit).toEqual({
      brand_id: "brand-1",
      agent_id: "agent-1",
      agent_key: "STORY_TELLER",
      old_status: "LOCKED_BY_BRAIN",
      new_status: "ACTIVE",
      actor_id: "profile-1",
    });
    expect(auditJson).not.toContain("prompt");
    expect(auditJson).not.toContain("answer");
  });
});

describe("Agent activation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates an available current-brand entitlement and audits it", async () => {
    mockedGetAgentCatalogWorkspace.mockResolvedValue(workspace());

    const entitlementBuilder = {
      update: vi.fn(() => entitlementBuilder),
      eq: vi.fn(() => entitlementBuilder),
      in: vi.fn(() => entitlementBuilder),
      select: vi.fn(() => entitlementBuilder),
      maybeSingle: vi.fn(() =>
        Promise.resolve({ data: { id: "entitlement-1" }, error: null }),
      ),
    };
    const auditBuilder = {
      insert: vi.fn((value: unknown) =>
        Promise.resolve({ data: value, error: null }),
      ),
    };
    const from = vi.fn((table: string) => {
      if (table === "agent_entitlements") return entitlementBuilder;
      if (table === "audit_logs") return auditBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    mockedCreateAdminClient.mockReturnValue({ from } as never);

    const result = await activateCatalogAgent({
      profile: profile(),
      agentKey: "STORY_TELLER",
    });

    expect(result).toEqual({
      agentKey: "STORY_TELLER",
      message: "Story Teller is now active.",
    });
    expect(entitlementBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ACTIVE",
      }),
    );
    expect(entitlementBuilder.eq).toHaveBeenCalledWith(
      "brand_id",
      "brand-1",
    );
    expect(entitlementBuilder.eq).toHaveBeenCalledWith("agent_id", "agent-1");
    expect(entitlementBuilder.in).toHaveBeenCalledWith("status", [
      "LOCKED_BY_BRAIN",
      "AVAILABLE",
    ]);
    expect(auditBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "agent_activated",
        entity_type: "agent_entitlement",
        entity_id: "entitlement-1",
        brand_id: "brand-1",
      }),
    );
  });

  it("rejects Brand Specialist activation and plan-excluded agents", async () => {
    mockedGetAgentCatalogWorkspace.mockResolvedValue(
      workspace({
        access: {
          brandId: "brand-1",
          brandName: "Helio",
          membershipRole: "BRAND_SPECIALIST",
          planName: "ADVANCED",
        },
      }),
    );

    await expect(
      activateCatalogAgent({
        profile: profile(),
        agentKey: "STORY_TELLER",
      }),
    ).rejects.toSatisfy(isAgentActivationServiceError);

    mockedGetAgentCatalogWorkspace.mockResolvedValue(
      workspace({
        agents: [
          catalogAgent({
            entitlementId: null,
            entitlementStatus: null,
            displayState: "LOCKED_BY_PLAN",
            isActivatable: false,
            stateMessage: "This agent is not included in the current plan.",
          }),
        ],
      }),
    );

    await expect(
      activateCatalogAgent({
        profile: profile(),
        agentKey: "STORY_TELLER",
      }),
    ).rejects.toSatisfy(isAgentActivationServiceError);
  });

  it("rejects activation while Brain is not ready", async () => {
    mockedGetAgentCatalogWorkspace.mockResolvedValue(
      workspace({
        brainReady: false,
        brainReadinessMessage: "Brand Brain is locked.",
        agents: [
          catalogAgent({
            displayState: "LOCKED_BY_BRAIN",
            isActivatable: false,
            stateMessage:
              "Brand Brain must be ready before this agent can activate.",
          }),
        ],
      }),
    );

    await expect(
      activateCatalogAgent({
        profile: profile(),
        agentKey: "STORY_TELLER",
      }),
    ).rejects.toSatisfy(isAgentActivationServiceError);
  });
});

describe("Agent catalog components", () => {
  it("renders list states for locked, available, active, and suspended agents", () => {
    render(
      <AgentCatalogList
        workspace={workspace({
          brainReady: false,
          brainReadinessMessage: "Brand Brain is locked.",
          agents: [
            catalogAgent({
              key: "STORY_TELLER",
              slug: "story-teller",
              name: "Story Teller",
              displayState: "LOCKED_BY_PLAN",
              isActivatable: false,
              stateMessage: "This agent is not included in the current plan.",
            }),
            catalogAgent({
              key: "IMAGE_GENERATOR",
              slug: "image-generator",
              name: "Image Generator",
              displayState: "LOCKED_BY_BRAIN",
              isActivatable: false,
              stateMessage:
                "Brand Brain must be ready before this agent can activate.",
            }),
            catalogAgent({
              key: "VIDEO_GENERATOR",
              slug: "video-generator",
              name: "Video Generator",
              displayState: "AVAILABLE",
              isActivatable: true,
            }),
            catalogAgent({
              key: "CAMPAIGN_MAKER",
              slug: "campaign-maker",
              name: "Campaign Maker",
              displayState: "ACTIVE",
              isActivatable: false,
            }),
            catalogAgent({
              key: "BRAND_DIGITAL_ACTIVATION",
              slug: "brand-digital-activation",
              name: "Brand Digital Activation",
              displayState: "SUSPENDED",
              isActivatable: false,
            }),
          ],
        })}
      />,
    );

    expect(screen.getByText("Locked by plan")).toBeVisible();
    expect(screen.getByText("Locked by Brain")).toBeVisible();
    expect(screen.getByText("Available")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("Suspended")).toBeVisible();
  });

  it("renders activation controls only as enabled for available agents", () => {
    const { rerender } = render(
      <AgentDetail access={workspace().access} agent={catalogAgent()} />,
    );

    expect(
      screen.getByRole("button", { name: "Activate agent" }),
    ).toBeEnabled();

    rerender(
      <AgentDetail
        access={workspace().access}
        agent={catalogAgent({
          displayState: "LOCKED_BY_PLAN",
          isActivatable: false,
          stateMessage: "This agent is not included in the current plan.",
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Activate agent" }),
    ).toBeDisabled();
  });
});
