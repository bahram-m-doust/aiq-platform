import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  getBrandAgentInstruction,
  listBrandInstructionSlots,
} from "@/features/agents/instructions/queries";
import {
  brandInstructionMaxLength,
  joinPromptLayers,
  resolveEffectiveInstruction,
  validateInstruction,
} from "@/features/agents/instructions/schema";
import type { BrandAgentInstruction } from "@/features/agents/instructions/types";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

describe("instruction schema", () => {
  it("trims, allows empty, and caps length", () => {
    expect(validateInstruction("  Be bold.  ")).toEqual({
      instruction: "Be bold.",
      error: null,
    });
    expect(validateInstruction("   ")).toEqual({ instruction: "", error: null });
    expect(
      validateInstruction("x".repeat(brandInstructionMaxLength + 1)).error,
    ).toMatch(/under/);
  });

  it("resolves per-agent over brand-wide, honoring enabled flags", () => {
    const rows: BrandAgentInstruction[] = [
      { agentId: null, instruction: "Brand voice.", isEnabled: true, updatedAt: null },
      { agentId: "a1", instruction: "Agent voice.", isEnabled: true, updatedAt: null },
    ];
    expect(resolveEffectiveInstruction(rows, "a1")).toBe("Agent voice.");

    // Per-agent disabled -> fall back to brand-wide.
    const disabled: BrandAgentInstruction[] = [
      { agentId: null, instruction: "Brand voice.", isEnabled: true, updatedAt: null },
      { agentId: "a1", instruction: "Agent voice.", isEnabled: false, updatedAt: null },
    ];
    expect(resolveEffectiveInstruction(disabled, "a1")).toBe("Brand voice.");

    // Nothing applicable -> empty.
    expect(resolveEffectiveInstruction([], "a1")).toBe("");
  });

  it("joins prompt layers, dropping empties", () => {
    expect(joinPromptLayers(["Role", "", "  ", "Guard", null])).toBe(
      "Role\n\nGuard",
    );
  });
});

describe("getBrandAgentInstruction", () => {
  beforeEach(() => vi.clearAllMocks());

  function mockRows(rows: unknown[]) {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      or: vi.fn(() => Promise.resolve({ data: rows, error: null })),
    };
    mockedCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder) } as never);
  }

  it("returns the per-agent override when enabled", async () => {
    mockRows([
      { agent_id: null, instruction: "Brand voice.", is_enabled: true, updated_at: null },
      { agent_id: "a1", instruction: "Agent voice.", is_enabled: true, updated_at: null },
    ]);
    await expect(
      getBrandAgentInstruction({ brandId: "b1", agentId: "a1" }),
    ).resolves.toBe("Agent voice.");
  });

  it("falls back to the brand-wide default and then to empty", async () => {
    mockRows([
      { agent_id: null, instruction: "Brand voice.", is_enabled: true, updated_at: null },
    ]);
    await expect(
      getBrandAgentInstruction({ brandId: "b1", agentId: "a1" }),
    ).resolves.toBe("Brand voice.");

    mockRows([]);
    await expect(
      getBrandAgentInstruction({ brandId: "b1", agentId: "a1" }),
    ).resolves.toBe("");
  });
});

describe("listBrandInstructionSlots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the brand-wide slot first, then one slot per active agent", async () => {
    const agentsBuilder = {
      select: vi.fn(() => agentsBuilder),
      eq: vi.fn(() => agentsBuilder),
      order: vi.fn(() =>
        Promise.resolve({
          data: [
            { id: "a1", key: "BRAND_INTEGRATOR_BRAIN", name: "Brand Integrator Brain" },
          ],
          error: null,
        }),
      ),
    };
    const settingsBuilder = {
      select: vi.fn(() => settingsBuilder),
      eq: vi.fn(() =>
        Promise.resolve({
          data: [
            { agent_id: null, instruction: "Brand voice.", is_enabled: true, updated_at: "t0" },
          ],
          error: null,
        }),
      ),
    };
    const from = vi.fn((table: string) =>
      table === "agents" ? agentsBuilder : settingsBuilder,
    );
    mockedCreateAdminClient.mockReturnValue({ from } as never);

    const slots = await listBrandInstructionSlots("b1");

    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      agentId: null,
      agentName: "Brand-wide default",
      instruction: "Brand voice.",
      isEnabled: true,
    });
    expect(slots[1]).toMatchObject({
      agentId: "a1",
      agentKey: "BRAND_INTEGRATOR_BRAIN",
      instruction: "",
      isEnabled: true,
    });
  });
});
