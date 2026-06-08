import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/agents/brain/actions", () => ({
  askBrandBrainAction: vi.fn(),
  initialBrandBrainChatFormState: { status: "idle", message: "" },
}));

vi.mock("@/features/agents/brain/llm", () => ({
  createBrandBrainResponse: vi.fn(),
  getBrandBrainModel: vi.fn(() => "gpt-test"),
  isLLMBrainConfigError: vi.fn(() => false),
}));

vi.mock("@/features/agents/brain/queries", () => ({
  getBrandBrainWorkspace: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  createBrandBrainResponse,
  getBrandBrainModel,
} from "@/features/agents/brain/llm";
import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { BrainChat } from "@/features/agents/brain/components/BrainChat";
import { BrainLockedState } from "@/features/agents/brain/components/BrainLockedState";
import {
  brandBrainHistoryMaxMessages,
  canUseBrandBrainRole,
  extractBrandBrainSources,
  normalizeBrandBrainHistory,
  parseBrandBrainHistory,
  resolveBrandBrainReadiness,
  toAgentRunAuditMetadata,
  validateBrandBrainPrompt,
  validateBrandBrainPromptFormData,
} from "@/features/agents/brain/schema";
import { runBrandBrain } from "@/features/agents/brain/services";
import type { UserProfile } from "@/features/auth/types";
import type {
  BrandBrainAccess,
  BrandBrainWorkspace,
} from "@/features/agents/brain/types";
import { formData } from "@/tests/helpers/formData";

const mockedCreateBrandBrainResponse = vi.mocked(createBrandBrainResponse);
const mockedGetBrandBrainModel = vi.mocked(getBrandBrainModel);
const mockedGetBrandBrainWorkspace = vi.mocked(getBrandBrainWorkspace);
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

function brainAccess(
  overrides: Partial<BrandBrainAccess> = {},
): BrandBrainAccess {
  return {
    brandId: "brand-1",
    brandName: "Helio",
    membershipRole: "OWNER",
    planName: "ADVANCED",
    ...overrides,
  };
}

function readyWorkspace(
  overrides: Partial<BrandBrainWorkspace> = {},
): BrandBrainWorkspace {
  return {
    access: brainAccess(),
    agent: {
      id: "agent-1",
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

describe("Brand Brain rules", () => {
  it("allows only Owner and Executive Manager roles", () => {
    expect(canUseBrandBrainRole("OWNER")).toBe(true);
    expect(canUseBrandBrainRole("EXECUTIVE_MANAGER")).toBe(true);
    expect(canUseBrandBrainRole("BRAND_SPECIALIST")).toBe(false);
    expect(canUseBrandBrainRole(null)).toBe(false);
  });

  it("locks before RAG_SYNCED knowledge base readiness", () => {
    const readiness = resolveBrandBrainReadiness({
      accessSummary: {
        status: "ACTIVE_ACCESS",
        brandId: "brand-1",
        membershipRole: "OWNER",
      },
      hasAgent: true,
      knowledgeBaseId: "kb-1",
      knowledgeBaseStatus: "RAG_APPROVED",
      providerVectorStoreId: "vs_123",
      syncedFileCount: 1,
    });

    expect(readiness.isReady).toBe(false);
    expect(readiness.status).toBe("KNOWLEDGE_BASE_NOT_SYNCED");
  });

  it("locks when knowledge base is not synced or synced files are missing", () => {
    expect(
      resolveBrandBrainReadiness({
        accessSummary: {
          status: "ACTIVE_ACCESS",
          brandId: "brand-1",
          membershipRole: "OWNER",
        },
        hasAgent: true,
        knowledgeBaseId: "kb-1",
        knowledgeBaseStatus: "NOT_READY",
        providerVectorStoreId: null,
        syncedFileCount: 1,
      }).status,
    ).toBe("KNOWLEDGE_BASE_NOT_SYNCED");

    expect(
      resolveBrandBrainReadiness({
        accessSummary: {
          status: "ACTIVE_ACCESS",
          brandId: "brand-1",
          membershipRole: "OWNER",
        },
        hasAgent: true,
        knowledgeBaseId: "kb-1",
        knowledgeBaseStatus: "RAG_SYNCED",
        providerVectorStoreId: null,
        syncedFileCount: 0,
      }).status,
    ).toBe("NO_SYNCED_FILES");
  });

  it("accepts ready Owner access with a synced vector store and synced file", () => {
    const readiness = resolveBrandBrainReadiness({
      accessSummary: {
        status: "ACTIVE_ACCESS",
        brandId: "brand-1",
        membershipRole: "OWNER",
      },
      hasAgent: true,
      knowledgeBaseId: "kb-1",
      knowledgeBaseStatus: "RAG_SYNCED",
      providerVectorStoreId: "vs_123",
      syncedFileCount: 1,
    });

    expect(readiness.isReady).toBe(true);
    expect(readiness.providerVectorStoreId).toBe("vs_123");
  });

  it("validates and trims prompts", () => {
    expect(
      validateBrandBrainPromptFormData(formData({ prompt: "  Strategy?  " })),
    ).toEqual({ prompt: "Strategy?", error: null });
    expect(validateBrandBrainPromptFormData(new FormData()).error).toBe(
      "Enter a question for Brand Brain.",
    );
  });

  it("parses conversation history defensively and caps the memory window", () => {
    const valid = [
      { role: "user", content: "  What is the positioning?  " },
      { role: "assistant", content: "It is premium." },
      { role: "system", content: "ignored role" },
      { role: "user", content: "" },
      { role: "user", content: 42 },
      "not-an-object",
    ];

    expect(
      parseBrandBrainHistory(
        formData({ history: JSON.stringify(valid) }),
      ),
    ).toEqual([
      { role: "user", content: "What is the positioning?" },
      { role: "assistant", content: "It is premium." },
    ]);

    expect(parseBrandBrainHistory(new FormData())).toEqual([]);
    expect(
      parseBrandBrainHistory(formData({ history: "not json" })),
    ).toEqual([]);

    const overflow = Array.from(
      { length: brandBrainHistoryMaxMessages + 4 },
      (_, index) => ({ role: "user", content: `q${index}` }),
    );
    const parsed = parseBrandBrainHistory(
      formData({ history: JSON.stringify(overflow) }),
    );
    expect(parsed).toHaveLength(brandBrainHistoryMaxMessages);
    expect(parsed[parsed.length - 1]?.content).toBe(
      `q${overflow.length - 1}`,
    );
  });

  it("validates and normalizes JSON-body prompts and history for the stream route", () => {
    expect(validateBrandBrainPrompt("  Positioning?  ")).toEqual({
      prompt: "Positioning?",
      error: null,
    });
    expect(validateBrandBrainPrompt(42).error).toBe(
      "Enter a question for Brand Brain.",
    );

    expect(
      normalizeBrandBrainHistory([
        { role: "user", content: "  Hi  " },
        { role: "assistant", content: "Hello." },
        { role: "system", content: "drop me" },
        { role: "user", content: "" },
      ]),
    ).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello." },
    ]);

    expect(normalizeBrandBrainHistory("not-an-array")).toEqual([]);

    const overflow = Array.from(
      { length: brandBrainHistoryMaxMessages + 3 },
      (_, index) => ({ role: "user" as const, content: `q${index}` }),
    );
    expect(normalizeBrandBrainHistory(overflow)).toHaveLength(
      brandBrainHistoryMaxMessages,
    );
  });

  it("extracts safe file-search sources without document content", () => {
    const sources = extractBrandBrainSources({
      output: [
        {
          type: "file_search_call",
          results: [
            {
              file_id: "file_openai_1",
              filename: "brand-knowledge.pdf",
              score: 0.89,
              attributes: {
                brand_id: "brand-1",
                ignored: { nested: "value" },
              },
              text: "do not keep document text",
            },
          ],
        },
      ],
    });
    const json = JSON.stringify(sources);

    expect(sources).toEqual([
      {
        fileName: "brand-knowledge.pdf",
        providerFileId: "file_openai_1",
        score: 0.89,
        attributes: { brand_id: "brand-1" },
      },
    ]);
    expect(json).not.toContain("do not keep document text");
  });

  it("builds audit metadata without prompt or answer content", () => {
    const audit = toAgentRunAuditMetadata({
      brandId: "brand-1",
      agentId: "agent-1",
      runId: "run-1",
      userId: "profile-1",
      model: "gpt-test",
    });
    const auditJson = JSON.stringify(audit);

    expect(audit).toEqual({
      brand_id: "brand-1",
      agent_id: "agent-1",
      run_id: "run-1",
      user_id: "profile-1",
      model: "gpt-test",
    });
    expect(auditJson).not.toContain("prompt");
    expect(auditJson).not.toContain("answer");
  });
});

describe("Brand Brain service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetBrandBrainModel.mockReturnValue("gpt-test");
    mockedGetBrandBrainWorkspace.mockResolvedValue(readyWorkspace());
    mockedCreateBrandBrainResponse.mockResolvedValue({
      responseId: "resp-1",
      answer: "The brand opportunity is clear.",
      retrievedSources: [
        {
          fileName: "brand-knowledge.pdf",
          providerFileId: "file_openai_1",
          score: 0.89,
          attributes: { brand_id: "brand-1" },
        },
      ],
      displaySources: [{ fileName: "brand-knowledge.pdf", score: 0.89 }],
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        costCents: 0.15,
        model: "gpt-test",
      },
    });
  });

  it("uses only the current brand vector store and logs the run safely", async () => {
    const agentRunBuilder = {
      insert: vi.fn(() => agentRunBuilder),
      update: vi.fn(() => agentRunBuilder),
      select: vi.fn(() => agentRunBuilder),
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: vi.fn(() =>
        Promise.resolve({ data: { id: "run-1" }, error: null }),
      ),
    };
    const auditInsert = vi.fn((value: unknown) =>
      Promise.resolve({ data: value, error: null }),
    );
    const auditBuilder = {
      insert: auditInsert,
    };
    const brandsBuilder = {
      select: vi.fn(() => brandsBuilder),
      eq: vi.fn(() => brandsBuilder),
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: { monthly_budget_cents: null },
          error: null,
        }),
      ),
    };
    const usageBuilder = {
      select: vi.fn(() => usageBuilder),
      eq: vi.fn(() => usageBuilder),
      gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn((value: unknown) =>
        Promise.resolve({ data: value, error: null }),
      ),
    };
    const from = vi.fn((table: string) => {
      if (table === "agent_runs") return agentRunBuilder;
      if (table === "audit_logs") return auditBuilder;
      if (table === "brands") return brandsBuilder;
      if (table === "agent_run_usage") return usageBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    mockedCreateAdminClient.mockReturnValue({ from } as never);

    const result = await runBrandBrain({
      profile: profile(),
      prompt: "Summarize the positioning implications.",
    });

    expect(result).toMatchObject({
      runId: "run-1",
      answer: "The brand opportunity is clear.",
      model: "gpt-test",
    });
    expect(mockedCreateBrandBrainResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: "brand-1",
      }),
    );
    expect(agentRunBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        agent_id: "agent-1",
        user_id: "profile-1",
        input: { prompt: "Summarize the positioning implications." },
        output: {
          answer: "The brand opportunity is clear.",
          response_id: "resp-1",
        },
        provider: "OPENROUTER",
        model: "gpt-test",
        cost: null,
      }),
    );

    const auditCall = auditInsert.mock.calls[0]?.[0];
    const auditJson = JSON.stringify(auditCall);

    expect(auditCall).toMatchObject({
      action: "agent_run_created",
      entity_type: "agent_run",
      entity_id: "run-1",
    });
    expect(auditJson).not.toContain("Summarize the positioning");
    expect(auditJson).not.toContain("The brand opportunity");
  });
});

describe("Brand Brain components", () => {
  it("renders locked state without chat controls", () => {
    render(
      <BrainLockedState
        access={brainAccess()}
        readiness={{
          isReady: false,
          status: "KNOWLEDGE_BASE_NOT_SYNCED",
          message:
            "Brand Brain is locked until the current brand knowledge base has completed RAG sync.",
          knowledgeBaseId: "kb-1",
          providerVectorStoreId: null,
          syncedFileCount: 0,
        }}
      />,
    );

    expect(screen.getByText("Brand Brain locked")).toBeVisible();
    expect(screen.queryByLabelText("Question")).not.toBeInTheDocument();
  });

  it("renders the ready chat input for the current brand", () => {
    render(<BrainChat access={brainAccess()} />);

    expect(screen.getByText("Brand Brain")).toBeVisible();
    expect(screen.getByLabelText("Question")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Ask Brand Brain/i }),
    ).toBeVisible();
    expect(screen.getAllByText("Helio").length).toBeGreaterThan(0);
  });
});
