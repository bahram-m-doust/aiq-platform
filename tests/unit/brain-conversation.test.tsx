import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/agents/runs/image-storage", () => ({
  createAgentImageSignedUrls: vi.fn((paths: string[]) =>
    Promise.resolve(paths.map((path) => `signed://${path}`)),
  ),
}));

import { getBrandBrainConversation } from "@/features/agents/brain/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

type AgentRunRow = {
  id: string;
  input: unknown;
  output: unknown;
  retrieved_sources: unknown;
  created_at: string | null;
};

function mockRows(rows: AgentRunRow[]) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  const from = vi.fn(() => builder);
  mockedCreateAdminClient.mockReturnValue({ from } as never);
  return { from, builder };
}

describe("getBrandBrainConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rehydrates question/answer turns in chronological order with sources", async () => {
    // Stored newest-first (matching the DB order) — the query reverses them.
    mockRows([
      {
        id: "run-2",
        input: { prompt: "And the risks?" },
        output: { answer: "Three risks stand out." },
        retrieved_sources: [
          { fileName: "risks.pdf", score: 0.71, providerFileId: "f2" },
        ],
        created_at: "2026-01-02T00:00:00Z",
      },
      {
        id: "run-1",
        input: { prompt: "What is the positioning?" },
        output: { answer: "Premium and focused." },
        retrieved_sources: [{ fileName: "brand.pdf", score: 0.9 }],
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const messages = await getBrandBrainConversation({
      brandId: "brand-1",
      agentId: "agent-1",
      userId: "user-1",
    });

    expect(messages).toEqual([
      {
        id: "run-1-q",
        role: "user",
        content: "What is the positioning?",
        sources: null,
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "run-1-a",
        role: "assistant",
        content: "Premium and focused.",
        sources: [{ fileName: "brand.pdf", score: 0.9 }],
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "run-2-q",
        role: "user",
        content: "And the risks?",
        sources: null,
        createdAt: "2026-01-02T00:00:00Z",
      },
      {
        id: "run-2-a",
        role: "assistant",
        content: "Three risks stand out.",
        sources: [{ fileName: "risks.pdf", score: 0.71 }],
        createdAt: "2026-01-02T00:00:00Z",
      },
    ]);
  });

  it("rehydrates an image run with signed URLs and the optimized prompt", async () => {
    mockRows([
      {
        id: "run-img",
        input: { prompt: "A hero banner", mode: "image" },
        output: {
          answer: "Generated 1 image(s).",
          image_prompt: "On-brand hero banner, teal palette",
          image_paths: ["brand-1/run-img/0.png"],
        },
        retrieved_sources: [{ fileName: "brand.pdf", score: 0.8 }],
        created_at: "2026-01-03T00:00:00Z",
      },
    ]);

    const messages = await getBrandBrainConversation({
      brandId: "brand-1",
      agentId: "agent-1",
      userId: "user-1",
    });

    expect(messages).toEqual([
      {
        id: "run-img-q",
        role: "user",
        content: "A hero banner",
        sources: null,
        createdAt: "2026-01-03T00:00:00Z",
      },
      {
        id: "run-img-a",
        role: "assistant",
        content: "Generated 1 image(s).",
        sources: [{ fileName: "brand.pdf", score: 0.8 }],
        images: ["signed://brand-1/run-img/0.png"],
        imagePrompt: "On-brand hero banner, teal palette",
        createdAt: "2026-01-03T00:00:00Z",
      },
    ]);
  });

  it("skips runs without a stored prompt or answer", async () => {
    mockRows([
      {
        id: "run-empty",
        input: {},
        output: {},
        retrieved_sources: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    await expect(
      getBrandBrainConversation({
        brandId: "brand-1",
        agentId: "agent-1",
        userId: "user-1",
      }),
    ).resolves.toEqual([]);
  });

  it("returns an empty thread when the user has no runs", async () => {
    mockRows([]);

    await expect(
      getBrandBrainConversation({
        brandId: "brand-1",
        agentId: "agent-1",
        userId: "user-1",
      }),
    ).resolves.toEqual([]);
  });
});
