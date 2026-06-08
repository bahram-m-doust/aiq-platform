import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/agents/brain/queries", () => ({
  getBrandBrainWorkspace: vi.fn(),
}));
vi.mock("@/features/agents/brain/llm", () => ({
  retrieveBrandBrainContext: vi.fn(),
}));
vi.mock("@/features/agents/instructions/queries", () => ({
  getBrandAgentInstruction: vi.fn(),
}));
vi.mock("@/features/agents/runs/llm", () => ({
  rewritePromptForImage: vi.fn(),
}));
vi.mock("@/features/agents/runs/services", () => ({
  getBrandModelDefaults: vi.fn(),
}));
vi.mock("@/features/agents/runs/image-storage", () => ({
  uploadAgentImagePng: vi.fn(() => Promise.resolve()),
  createAgentImageSignedUrls: vi.fn((paths: string[]) =>
    Promise.resolve(paths.map((path) => `signed://${path}`)),
  ),
}));
vi.mock("@/lib/openrouter/image", () => ({
  generateImage: vi.fn(),
}));
vi.mock("@/features/openrouter/usage", () => ({
  assertWithinBudget: vi.fn(() => Promise.resolve()),
  recordRunUsage: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/audit/logAudit", () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { runBrandBrainImage } from "@/features/agents/brain/image";
import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import { retrieveBrandBrainContext } from "@/features/agents/brain/llm";
import { getBrandAgentInstruction } from "@/features/agents/instructions/queries";
import { rewritePromptForImage } from "@/features/agents/runs/llm";
import { getBrandModelDefaults } from "@/features/agents/runs/services";
import {
  createAgentImageSignedUrls,
  uploadAgentImagePng,
} from "@/features/agents/runs/image-storage";
import { generateImage } from "@/lib/openrouter/image";
import { recordRunUsage } from "@/features/openrouter/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserProfile } from "@/features/auth/types";

const mockedWorkspace = vi.mocked(getBrandBrainWorkspace);
const mockedRetrieve = vi.mocked(retrieveBrandBrainContext);
const mockedInstruction = vi.mocked(getBrandAgentInstruction);
const mockedRewrite = vi.mocked(rewritePromptForImage);
const mockedDefaults = vi.mocked(getBrandModelDefaults);
const mockedGenerate = vi.mocked(generateImage);
const mockedUpload = vi.mocked(uploadAgentImagePng);
const mockedSignedUrls = vi.mocked(createAgentImageSignedUrls);
const mockedRecordUsage = vi.mocked(recordRunUsage);
const mockedAdmin = vi.mocked(createAdminClient);

function profile(): UserProfile {
  return {
    id: "profile-1",
    auth_user_id: "auth-1",
    email: "owner@example.com",
    full_name: null,
    global_role: "REGISTERED_USER",
  };
}

describe("runBrandBrainImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedWorkspace.mockResolvedValue({
      access: {
        brandId: "brand-1",
        brandName: "Helio",
        membershipRole: "OWNER",
        planName: "ADVANCED",
      },
      agent: { id: "agent-1", key: "BRAND_INTEGRATOR_BRAIN", name: "Brand Brain" },
      readiness: {
        isReady: true,
        status: "READY",
        message: "Brand Brain is ready.",
        knowledgeBaseId: "kb-1",
        providerVectorStoreId: "vs",
        syncedFileCount: 1,
      },
    });
    mockedRetrieve.mockResolvedValue({
      context: "## Brand Knowledge Context\n\n...",
      retrievedSources: [
        {
          fileName: "brand.pdf",
          score: 0.8,
          providerFileId: "f1",
          attributes: { chunk_id: "c1", knowledge_file_id: "f1" },
        },
      ],
      displaySources: [{ fileName: "brand.pdf", score: 0.8 }],
    });
    mockedInstruction.mockResolvedValue("Use a teal palette.");
    mockedDefaults.mockResolvedValue({
      text: "openai/gpt-4o-mini",
      image: "openai/gpt-image-1",
    } as never);
    mockedRewrite.mockResolvedValue({
      optimizedPrompt: "Teal hero banner, minimal",
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        costCents: 0.1,
        model: "openai/gpt-4o-mini",
      },
    } as never);
    mockedGenerate.mockResolvedValue({
      b64Images: ["AAAA"],
      usage: { imageCount: 1, costCents: 4, model: "openai/gpt-image-1" },
    } as never);

    const agentRunsBuilder = {
      insert: vi.fn(() => agentRunsBuilder),
      select: vi.fn(() => agentRunsBuilder),
      single: vi.fn(() => Promise.resolve({ data: { id: "run-img" }, error: null })),
      update: vi.fn(() => agentRunsBuilder),
      eq: vi.fn(() => Promise.resolve({ error: null })),
    };
    const agentsBuilder = {
      select: vi.fn(() => agentsBuilder),
      eq: vi.fn(() => agentsBuilder),
      maybeSingle: vi.fn(() =>
        Promise.resolve({ data: { id: "img-agent" }, error: null }),
      ),
    };
    const from = vi.fn((table: string) =>
      table === "agents" ? agentsBuilder : agentRunsBuilder,
    );
    mockedAdmin.mockReturnValue({ from } as never);
  });

  it("runs the two-stage pipeline and returns signed images for the thread", async () => {
    const result = await runBrandBrainImage({
      profile: profile(),
      prompt: "A hero banner",
    });

    expect(result).toEqual({
      runId: "run-img",
      optimizedPrompt: "Teal hero banner, minimal",
      images: ["signed://brand-1/run-img/0.png"],
      sources: [{ fileName: "brand.pdf", score: 0.8 }],
    });

    // Brand instruction flows into the prompt-rewrite stage.
    expect(mockedRewrite).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: "brand-1",
        instruction: "Use a teal palette.",
      }),
    );
    // Image stored under the run id path.
    expect(mockedUpload).toHaveBeenCalledWith(
      expect.objectContaining({ storagePath: "brand-1/run-img/0.png" }),
    );
    expect(mockedSignedUrls).toHaveBeenCalledWith(["brand-1/run-img/0.png"]);
    // Both text and image usage are metered.
    expect(mockedRecordUsage).toHaveBeenCalledTimes(2);
  });
});
