import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/features/auth/queries", () => ({
  requirePlatformOwner: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/audit/logAudit", () => ({
  logAudit: vi.fn(() => Promise.resolve(true)),
}));

import {
  getBrandAgentInstruction,
  listBrandInstructionSlots,
} from "@/features/agents/instructions/queries";
import { BrandInstructionForm } from "@/features/agents/instructions/components/BrandInstructionForm";
import { saveBrandAgentInstructionAction } from "@/features/agents/instructions/actions";
import { upsertBrandAgentInstruction } from "@/features/agents/instructions/services";
import {
  brandInstructionMaxLength,
  joinPromptLayers,
  resolveEffectiveInstruction,
  validateInstruction,
} from "@/features/agents/instructions/schema";
import type { BrandAgentInstruction } from "@/features/agents/instructions/types";
import { requirePlatformOwner } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedRequirePlatformOwner = vi.mocked(requirePlatformOwner);

const ownerProfile = {
  id: "owner-1",
  auth_user_id: "auth-owner-1",
  email: "owner@example.com",
  full_name: null,
  global_role: "PLATFORM_OWNER" as const,
};

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

  it("resolves only the enabled brand prompt and ignores per-agent rows", () => {
    const rows: BrandAgentInstruction[] = [
      { agentId: null, instruction: "Brand voice.", isEnabled: true, updatedAt: null },
      { agentId: "a1", instruction: "Agent voice.", isEnabled: true, updatedAt: null },
    ];
    expect(resolveEffectiveInstruction(rows, "a1")).toBe("Brand voice.");

    const disabled: BrandAgentInstruction[] = [
      { agentId: null, instruction: "Brand voice.", isEnabled: false, updatedAt: null },
      { agentId: "a1", instruction: "Agent voice.", isEnabled: true, updatedAt: null },
    ];
    expect(resolveEffectiveInstruction(disabled, "a1")).toBe("");

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

  function mockPromptRow(row: unknown | null) {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      maybeSingle: vi.fn(() => Promise.resolve({ data: row, error: null })),
    };
    mockedCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder) } as never);
    return builder;
  }

  it("returns the brand prompt for any agent id", async () => {
    const builder = mockPromptRow({
      agent_id: null,
      instruction: "Brand voice.",
      is_enabled: true,
      updated_at: null,
    });
    await expect(
      getBrandAgentInstruction({ brandId: "b1", agentId: "a1" }),
    ).resolves.toBe("Brand voice.");
    expect(builder.is).toHaveBeenCalledWith("agent_id", null);
  });

  it("returns empty when the brand prompt is missing", async () => {
    mockPromptRow(null);
    await expect(
      getBrandAgentInstruction({ brandId: "b1", agentId: "a1" }),
    ).resolves.toBe("");
  });
});

describe("listBrandInstructionSlots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns exactly one brand prompt slot", async () => {
    const settingsBuilder = {
      select: vi.fn(() => settingsBuilder),
      eq: vi.fn(() => settingsBuilder),
      is: vi.fn(() => settingsBuilder),
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: {
            agent_id: null,
            instruction: "Brand voice.",
            is_enabled: true,
            updated_at: "t0",
          },
          error: null,
        }),
      ),
    };
    const from = vi.fn(() => settingsBuilder);
    mockedCreateAdminClient.mockReturnValue({ from } as never);

    const slots = await listBrandInstructionSlots("b1");

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      agentId: null,
      agentKey: null,
      agentName: "Brand Prompt",
      instruction: "Brand voice.",
      isEnabled: true,
    });
    expect(from).toHaveBeenCalledWith("brand_agent_settings");
  });
});

describe("BrandInstructionForm", () => {
  it("resets the textarea when switching between brands", async () => {
    const slot = {
      agentId: null,
      agentKey: null,
      agentName: "Brand Prompt",
      instruction: "Prompt for brand A",
      isEnabled: true,
      updatedAt: null,
    };

    const { rerender } = render(
      <BrandInstructionForm
        brandId="brand-a"
        brandName="Brand A"
        slot={slot}
      />,
    );

    expect(screen.getByLabelText("Prompt text")).toHaveValue(
      "Prompt for brand A",
    );

    rerender(
      <BrandInstructionForm
        brandId="brand-b"
        brandName="Brand B"
        slot={{ ...slot, instruction: "Prompt for brand B" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Prompt text")).toHaveValue(
        "Prompt for brand B",
      );
    });
  });
});

describe("upsertBrandAgentInstruction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses one race-safe RPC for a brand-wide instruction slot", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: "setting-1", error: null }));
    mockedCreateAdminClient.mockReturnValue({ rpc } as never);

    await upsertBrandAgentInstruction({
      profile: {
        id: "owner-1",
        auth_user_id: "auth-owner-1",
        email: "owner@example.com",
        full_name: null,
        global_role: "PLATFORM_OWNER",
      },
      brandId: "brand-1",
      agentId: null,
      instruction: "Use the approved brand voice.",
      isEnabled: true,
    });

    expect(rpc).toHaveBeenCalledWith(
      "upsert_brand_agent_instruction_atomic",
      {
        p_brand_id: "brand-1",
        p_agent_id: null,
        p_instruction: "Use the approved brand voice.",
        p_is_enabled: true,
        p_updated_by: "owner-1",
      },
    );
  });
});

describe("saveBrandAgentInstructionAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("always saves the single brand prompt, ignoring submitted agent fields", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: "setting-1", error: null }));
    mockedCreateAdminClient.mockReturnValue({ rpc } as never);
    mockedRequirePlatformOwner.mockResolvedValue({
      user: { email: "owner@example.com" },
      profile: ownerProfile,
    } as never);

    const formData = new FormData();
    formData.set("brandId", "brand-1");
    formData.set("agentId", "agent-should-not-be-used");
    formData.set("isEnabled", "off");
    formData.set("instruction", "Use the approved brand voice.");

    await expect(
      saveBrandAgentInstructionAction({ status: "idle", message: "" }, formData),
    ).resolves.toEqual({
      status: "success",
      message: "Brand prompt saved.",
    });

    expect(rpc).toHaveBeenCalledWith(
      "upsert_brand_agent_instruction_atomic",
      {
        p_brand_id: "brand-1",
        p_agent_id: null,
        p_instruction: "Use the approved brand voice.",
        p_is_enabled: true,
        p_updated_by: "owner-1",
      },
    );
  });
});
