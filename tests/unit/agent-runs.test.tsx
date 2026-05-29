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

vi.mock("@/features/agents/brain/queries", () => ({
  getBrandBrainWorkspace: vi.fn(),
}));

vi.mock("@/features/agents/runs/llm", () => ({
  createAgentRunResponse: vi.fn(),
  getAgentRunModel: vi.fn(() => "gpt-test"),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import { AgentDetail } from "@/features/agents/catalog/components/AgentDetail";
import type {
  AgentCatalogAccess,
  AgentCatalogItem,
} from "@/features/agents/catalog/types";
import {
  createAgentRunResponse,
  getAgentRunModel,
} from "@/features/agents/runs/llm";
import {
  agentSystemPrompts,
  getAgentSystemPrompt,
} from "@/features/agents/runs/prompts";
import {
  agentRunProvider,
  buildAgentKnowledgeModuleScope,
  extractAgentRunSources,
  parseRequiredModuleTypes,
  toAgentRunAuditMetadata,
  validateAgentRunFormData,
} from "@/features/agents/runs/schema";
import {
  isAgentRunServiceError,
  runCatalogAgent,
} from "@/features/agents/runs/services";
import type { AgentRunHistoryItem } from "@/features/agents/runs/types";
import type { UserProfile } from "@/features/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { formData } from "@/tests/helpers/formData";

const mockedGetBrandBrainWorkspace = vi.mocked(getBrandBrainWorkspace);
const mockedCreateAgentRunResponse = vi.mocked(createAgentRunResponse);
const mockedGetAgentRunModel = vi.mocked(getAgentRunModel);
const mockedCreateAdminClient = vi.mocked(createAdminClient);

function profile(): UserProfile {
  return {
    id: "profile-1",
    auth_user_id: "auth-1",
    email: "owner@example.com",
    full_name: null,
    global_role: "REGISTERED_USER",
  };
}

function brainWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    access: {
      brandId: "brand-1",
      brandName: "Helio",
      membershipRole: "OWNER",
      planName: "ADVANCED",
    },
    agent: {
      id: "brain-agent-1",
      key: "BRAND_INTEGRATOR_BRAIN",
      name: "BRAND_INTEGRATOR_BRAIN",
    },
    readiness: {
      isReady: true,
      status: "READY",
      message: "Brand Brain is ready.",
      knowledgeBaseId: "kb-1",
      providerVectorStoreId: "vs_current_brand",
      syncedFileCount: 1,
    },
    ...overrides,
  };
}

function access(): AgentCatalogAccess {
  return {
    brandId: "brand-1",
    brandName: "Helio",
    membershipRole: "OWNER",
    planName: "ADVANCED",
  };
}

function activeAgent(overrides: Partial<AgentCatalogItem> = {}): AgentCatalogItem {
  return {
    key: "STORY_TELLER",
    slug: "story-teller",
    name: "Story Teller",
    description: "Narrative development support.",
    agentId: "agent-1",
    entitlementId: "entitlement-1",
    entitlementStatus: "ACTIVE",
    displayState: "ACTIVE",
    isActivatable: false,
    stateMessage: "Story Teller is active.",
    activatedAt: "2026-05-18T08:00:00.000Z",
    ...overrides,
  };
}

function runHistory(): AgentRunHistoryItem[] {
  return [
    {
      id: "run-1",
      agentId: "agent-1",
      brandId: "brand-1",
      userId: "profile-1",
      createdAt: "2026-05-18T08:30:00.000Z",
      promptExcerpt: "Build a narrative arc for launch.",
      answerExcerpt: "Lead with the market shift and the brand's role.",
      model: "gpt-test",
      sources: [{ fileName: "brand-knowledge.pdf", score: 0.91 }],
    },
  ];
}

function queryBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    not: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  };

  return builder;
}

function insertBuilder(result: unknown) {
  const builder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
  };

  return builder;
}

function listBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    in: vi.fn(() => Promise.resolve(result)),
  };

  return builder;
}

function setupRunClient({
  agentRequiredModules = [],
  entitlementStatus = "ACTIVE",
  modules = [],
  knowledgeFiles = [],
}: {
  agentRequiredModules?: unknown;
  entitlementStatus?: string | null;
  modules?: Array<{ id: string }>;
  knowledgeFiles?: Array<{ module_id: string | null }>;
} = {}) {
  const agentBuilder = queryBuilder({
    data: {
      id: "agent-1",
      key: "STORY_TELLER",
      name: "Story Teller",
      required_modules: agentRequiredModules,
    },
    error: null,
  });
  const entitlementBuilder = queryBuilder({
    data: entitlementStatus
      ? { id: "entitlement-1", status: entitlementStatus }
      : null,
    error: null,
  });
  const modulesBuilder = listBuilder({ data: modules, error: null });
  const knowledgeBuilder = listBuilder({ data: knowledgeFiles, error: null });
  const agentRunsBuilder = {
    insert: vi.fn(() => agentRunsBuilder),
    update: vi.fn(() => agentRunsBuilder),
    select: vi.fn(() => agentRunsBuilder),
    eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    single: vi.fn(() =>
      Promise.resolve({ data: { id: "run-1" }, error: null }),
    ),
  };
  const auditBuilder = {
    insert: vi.fn((value: unknown) =>
      Promise.resolve({ data: value, error: null }),
    ),
  };
  const brandsBuilder = queryBuilder({
    data: {
      monthly_budget_cents: null,
      default_text_model: null,
      default_image_model: null,
    },
    error: null,
  });
  const usageQueryBuilder = {
    select: vi.fn(() => usageQueryBuilder),
    eq: vi.fn(() => usageQueryBuilder),
    gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
    insert: vi.fn((value: unknown) =>
      Promise.resolve({ data: value, error: null }),
    ),
  };
  const from = vi.fn((table: string) => {
    if (table === "agents") return agentBuilder;
    if (table === "agent_entitlements") return entitlementBuilder;
    if (table === "brand_modules") return modulesBuilder;
    if (table === "knowledge_files") return knowledgeBuilder;
    if (table === "agent_runs") return agentRunsBuilder;
    if (table === "audit_logs") return auditBuilder;
    if (table === "brands") return brandsBuilder;
    if (table === "agent_run_usage") return usageQueryBuilder;
    throw new Error(`Unexpected table ${table}`);
  });

  mockedCreateAdminClient.mockReturnValue({ from } as never);

  return {
    agentBuilder,
    entitlementBuilder,
    modulesBuilder,
    knowledgeBuilder,
    agentRunsBuilder,
    auditBuilder,
    brandsBuilder,
    usageQueryBuilder,
  };
}

describe("agent run rules", () => {
  it("defines formal current-brand-only prompts for each MVP agent", () => {
    Object.entries(agentSystemPrompts).forEach(([agentKey, prompt]) => {
      expect(prompt).toContain("current brand knowledge base");
      expect(prompt.toLowerCase()).toContain("formal");
      expect(prompt).toContain("Do not reference other brands");
      expect(getAgentSystemPrompt(agentKey as keyof typeof agentSystemPrompts))
        .toBe(prompt);
    });

    expect(agentSystemPrompts.IMAGE_GENERATOR).toContain(
      "image-generation prompt",
    );
    expect(agentSystemPrompts.VIDEO_GENERATOR).toContain(
      "Do not claim to generate video assets",
    );
  });

  it("validates agent run form input", () => {
    const parseAgentKey = vi.fn((value: string) =>
      value === "story-teller" ? "STORY_TELLER" : null,
    );

    expect(
      validateAgentRunFormData(
        formData({
          agent_key: " story-teller ",
          prompt: "  Build the campaign frame.  ",
        }),
        parseAgentKey,
      ),
    ).toEqual({
      agentKey: "STORY_TELLER",
      prompt: "Build the campaign frame.",
      error: null,
    });
    expect(validateAgentRunFormData(new FormData(), parseAgentKey).error).toBe(
      "Choose a valid agent.",
    );
  });

  it("builds module filters from required modules and synced module ids", () => {
    expect(
      parseRequiredModuleTypes([
        "Brand Knowledge",
        "Brand Knowledge",
        "  Visual System  ",
        "",
      ]),
    ).toEqual(["Brand Knowledge", "Visual System"]);

    expect(
      buildAgentKnowledgeModuleScope({
        requiredModuleTypes: [],
        syncedModuleIds: ["module-1"],
      }),
    ).toEqual({
      requiredModuleTypes: [],
      filteredModuleIds: [],
      filter: null,
    });

    expect(
      buildAgentKnowledgeModuleScope({
        requiredModuleTypes: ["Brand Knowledge"],
        syncedModuleIds: ["module-1"],
      }).filter,
    ).toEqual({ key: "module_id", type: "eq", value: "module-1" });

    expect(
      buildAgentKnowledgeModuleScope({
        requiredModuleTypes: ["Brand Knowledge"],
        syncedModuleIds: ["module-1", "module-2"],
      }).filter,
    ).toEqual({
      key: "module_id",
      type: "in",
      value: ["module-1", "module-2"],
    });
  });

  it("extracts safe file-search source metadata without document content", () => {
    const sources = extractAgentRunSources({
      output: [
        {
          type: "file_search_call",
          results: [
            {
              file_id: "file_openai_1",
              filename: "brand-system.pdf",
              score: 0.94,
              attributes: {
                module_id: "module-1",
                nested: { ignored: true },
              },
              text: "do not persist retrieved document text",
            },
          ],
        },
      ],
    });
    const sourcesJson = JSON.stringify(sources);

    expect(sources).toEqual([
      {
        fileName: "brand-system.pdf",
        providerFileId: "file_openai_1",
        score: 0.94,
        attributes: { module_id: "module-1" },
      },
    ]);
    expect(sourcesJson).not.toContain("retrieved document text");
  });

  it("builds safe audit metadata without prompt or answer content", () => {
    const audit = toAgentRunAuditMetadata({
      brandId: "brand-1",
      agentId: "agent-1",
      agentKey: "STORY_TELLER",
      runId: "run-1",
      userId: "profile-1",
      model: "gpt-test",
    });
    const auditJson = JSON.stringify(audit);

    expect(audit).toEqual({
      brand_id: "brand-1",
      agent_id: "agent-1",
      agent_key: "STORY_TELLER",
      run_id: "run-1",
      user_id: "profile-1",
      model: "gpt-test",
    });
    expect(auditJson).not.toContain("prompt");
    expect(auditJson).not.toContain("answer");
  });
});

describe("agent run service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetBrandBrainWorkspace.mockResolvedValue(brainWorkspace() as never);
    mockedGetAgentRunModel.mockReturnValue("gpt-test");
    mockedCreateAgentRunResponse.mockResolvedValue({
      responseId: "resp-1",
      answer: "A disciplined strategic response.",
      retrievedSources: [
        {
          fileName: "brand-knowledge.pdf",
          providerFileId: "knowledge-1",
          score: 0.91,
          attributes: { chunk_id: "chunk-1", knowledge_file_id: "knowledge-1" },
        },
      ],
      displaySources: [{ fileName: "brand-knowledge.pdf", score: 0.91 }],
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        costCents: 0.15,
        model: "gpt-test",
      },
    });
  });

  it("uses only the current brand vector store and stores successful runs", async () => {
    const builders = setupRunClient();

    const result = await runCatalogAgent({
      profile: profile(),
      agentKey: "STORY_TELLER",
      prompt: "Build the narrative frame.",
    });

    expect(result).toMatchObject({
      runId: "run-1",
      answer: "A disciplined strategic response.",
      model: "openai/gpt-4o-mini",
    });
    expect(mockedCreateAgentRunResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: "STORY_TELLER",
        brandId: "brand-1",
        moduleScope: expect.objectContaining({ filter: null }),
      }),
    );
    expect(builders.agentRunsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        agent_id: "agent-1",
        user_id: "profile-1",
        input: {
          prompt: "Build the narrative frame.",
          agent_key: "STORY_TELLER",
          required_modules: [],
          filtered_module_ids: [],
        },
        output: {
          answer: "A disciplined strategic response.",
          response_id: "resp-1",
        },
        provider: agentRunProvider,
        model: "openai/gpt-4o-mini",
        cost: null,
      }),
    );

    const auditCall = builders.auditBuilder.insert.mock.calls[0]?.[0];
    const auditJson = JSON.stringify(auditCall);

    expect(auditCall).toMatchObject({
      action: "agent_run_created",
      entity_type: "agent_run",
      entity_id: "run-1",
      brand_id: "brand-1",
    });
    expect(auditJson).not.toContain("Build the narrative frame");
    expect(auditJson).not.toContain("disciplined strategic response");
  });

  it("builds a module_id File Search filter from agents.required_modules", async () => {
    setupRunClient({
      agentRequiredModules: ["Brand Knowledge", "Visual System"],
      modules: [{ id: "module-1" }, { id: "module-2" }],
      knowledgeFiles: [{ module_id: "module-1" }, { module_id: "module-2" }],
    });

    await runCatalogAgent({
      profile: profile(),
      agentKey: "STORY_TELLER",
      prompt: "Translate the knowledge into a storyline.",
    });

    expect(mockedCreateAgentRunResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleScope: expect.objectContaining({
          requiredModuleTypes: ["Brand Knowledge", "Visual System"],
          filteredModuleIds: ["module-1", "module-2"],
          filter: {
            key: "module_id",
            type: "in",
            value: ["module-1", "module-2"],
          },
        }),
      }),
    );
  });

  it("rejects Specialist, locked Brain, and inactive entitlements", async () => {
    mockedGetBrandBrainWorkspace.mockResolvedValue(
      brainWorkspace({
        access: {
          brandId: "brand-1",
          brandName: "Helio",
          membershipRole: "BRAND_SPECIALIST",
          planName: "ADVANCED",
        },
      }) as never,
    );
    setupRunClient();

    await expect(
      runCatalogAgent({
        profile: profile(),
        agentKey: "STORY_TELLER",
        prompt: "Run this.",
      }),
    ).rejects.toSatisfy(isAgentRunServiceError);

    mockedGetBrandBrainWorkspace.mockResolvedValue(
      brainWorkspace({
        readiness: {
          isReady: false,
          status: "KNOWLEDGE_BASE_NOT_SYNCED",
          message: "Brand Brain is locked.",
          knowledgeBaseId: "kb-1",
          providerVectorStoreId: null,
          syncedFileCount: 0,
        },
      }) as never,
    );

    await expect(
      runCatalogAgent({
        profile: profile(),
        agentKey: "STORY_TELLER",
        prompt: "Run this.",
      }),
    ).rejects.toSatisfy(isAgentRunServiceError);

    mockedGetBrandBrainWorkspace.mockResolvedValue(brainWorkspace() as never);
    setupRunClient({ entitlementStatus: "LOCKED_BY_BRAIN" });

    await expect(
      runCatalogAgent({
        profile: profile(),
        agentKey: "STORY_TELLER",
        prompt: "Run this.",
      }),
    ).rejects.toSatisfy(isAgentRunServiceError);
  });

  it("rejects mapped agents when no synced module knowledge is available", async () => {
    setupRunClient({
      agentRequiredModules: ["Brand Knowledge"],
      modules: [{ id: "module-1" }],
      knowledgeFiles: [],
    });

    await expect(
      runCatalogAgent({
        profile: profile(),
        agentKey: "STORY_TELLER",
        prompt: "Run this.",
      }),
    ).rejects.toSatisfy(isAgentRunServiceError);
    expect(mockedCreateAgentRunResponse).not.toHaveBeenCalled();
  });
});

describe("agent run components", () => {
  it("renders the active agent run form and scoped run history", () => {
    render(
      <AgentDetail
        access={access()}
        agent={activeAgent()}
        runHistory={runHistory()}
      />,
    );

    expect(screen.getByText("Run Story Teller")).toBeVisible();
    expect(screen.getByLabelText("Request")).toBeVisible();
    expect(screen.getByRole("button", { name: "Run agent" })).toBeVisible();
    expect(screen.getByText("Run history")).toBeVisible();
    expect(screen.getByText("Build a narrative arc for launch.")).toBeVisible();
    expect(
      screen.getByText("Lead with the market shift and the brand's role."),
    ).toBeVisible();
    expect(screen.getByText("brand-knowledge.pdf")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Activate agent" }),
    ).not.toBeInTheDocument();
  });

  it("renders activation guidance instead of run controls for inactive agents", () => {
    render(
      <AgentDetail
        access={access()}
        agent={activeAgent({
          entitlementStatus: "LOCKED_BY_BRAIN",
          displayState: "LOCKED_BY_BRAIN",
          isActivatable: false,
          stateMessage:
            "Brand Brain must be ready before this agent can activate.",
        })}
      />,
    );

    expect(screen.getByText("Activation")).toBeVisible();
    expect(screen.getByRole("button", { name: "Activate agent" })).toBeDisabled();
    expect(screen.queryByLabelText("Request")).not.toBeInTheDocument();
  });
});
