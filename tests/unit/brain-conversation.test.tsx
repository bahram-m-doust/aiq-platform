import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
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
      },
      {
        id: "run-1-a",
        role: "assistant",
        content: "Premium and focused.",
        sources: [{ fileName: "brand.pdf", score: 0.9 }],
      },
      {
        id: "run-2-q",
        role: "user",
        content: "And the risks?",
        sources: null,
      },
      {
        id: "run-2-a",
        role: "assistant",
        content: "Three risks stand out.",
        sources: [{ fileName: "risks.pdf", score: 0.71 }],
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
