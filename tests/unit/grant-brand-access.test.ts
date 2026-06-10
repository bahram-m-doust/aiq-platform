import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/audit/logAudit", () => ({
  logAudit: vi.fn(() => Promise.resolve(true)),
}));

import { grantBrandAccess } from "@/features/access/grant-brand-access";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedLogAudit = vi.mocked(logAudit);

describe("atomic brand access grants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates entitlement and agent access through one idempotent RPC", async () => {
    const rpc = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            entitlement_id: "entitlement-1",
            entitlement_brand_id: "brand-1",
            entitlement_plan_id: "plan-1",
            entitlement_source: "ACCESS_KEY",
            entitlement_status: "ACTIVE",
            entitlement_starts_at: "2026-06-10T00:00:00.000Z",
            entitlement_expires_at: null,
            entitlement_granted_by: "owner-1",
            entitlement_manual_reference: null,
            entitlement_internal_note: null,
            entitlement_created_at: "2026-06-10T00:00:00.000Z",
            included_agent_keys: ["IMAGE_GENERATOR", "STORY_TELLER"],
            matched_agent_keys: ["STORY_TELLER"],
            agent_entitlement_count: 1,
          },
        ],
        error: null,
      }),
    );
    mockedCreateAdminClient.mockReturnValue({ rpc } as never);

    const result = await grantBrandAccess({
      brandId: "brand-1",
      planId: "plan-1",
      source: "ACCESS_KEY",
      startsAt: "2026-06-10T00:00:00.000Z",
      grantedByUserId: "owner-1",
      idempotencyKey: "access-key:key-1",
    });

    expect(rpc).toHaveBeenCalledWith("grant_brand_access_atomic", {
      p_brand_id: "brand-1",
      p_plan_id: "plan-1",
      p_source: "ACCESS_KEY",
      p_starts_at: "2026-06-10T00:00:00.000Z",
      p_expires_at: null,
      p_granted_by: "owner-1",
      p_manual_reference: null,
      p_internal_note: null,
      p_idempotency_key: "access-key:key-1",
    });
    expect(result).toMatchObject({
      entitlement: {
        id: "entitlement-1",
        brandId: "brand-1",
        status: "ACTIVE",
      },
      includedAgentKeys: ["IMAGE_GENERATOR", "STORY_TELLER"],
      matchedAgentKeys: ["STORY_TELLER"],
      unmatchedAgentKeys: ["IMAGE_GENERATOR"],
      agentEntitlementCount: 1,
    });
    expect(mockedLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "plan_granted",
        entityId: "entitlement-1",
      }),
    );
  });

  it("does not fall back to separate table writes when the transaction fails", async () => {
    const rpc = vi.fn(() =>
      Promise.resolve({
        data: null,
        error: { message: "transaction failed" },
      }),
    );
    const from = vi.fn();
    mockedCreateAdminClient.mockReturnValue({ rpc, from } as never);

    await expect(
      grantBrandAccess({
        brandId: "brand-1",
        planId: "plan-1",
        source: "DEMO",
        startsAt: "2026-06-10T00:00:00.000Z",
        grantedByUserId: "owner-1",
      }),
    ).rejects.toMatchObject({ message: "transaction failed" });

    expect(from).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });
});
