import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { activateRedeemedBrandMembership } from "@/features/access/redeemed-brand-membership";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

describe("redeemed brand membership activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates entitlement validation and membership activation to one RPC", async () => {
    const single = vi.fn(() =>
      Promise.resolve({
        data: {
          brand_id: "brand-1",
          brand_name: "Helio",
          brand_status: "CREATED",
          membership_id: "membership-1",
          membership_user_id: "profile-1",
          membership_role: "OWNER",
          membership_status: "ACTIVE",
          membership_invited_by: null,
        },
        error: null,
      }),
    );
    const rpc = vi.fn(() => ({ single }));
    mockedCreateAdminClient.mockReturnValue({ rpc } as never);

    await expect(
      activateRedeemedBrandMembership({
        accessKeyId: "access-key-1",
        userId: "profile-1",
      }),
    ).resolves.toEqual({
      brand: {
        id: "brand-1",
        name: "Helio",
        status: "CREATED",
      },
      membership: {
        id: "membership-1",
        brandId: "brand-1",
        userId: "profile-1",
        role: "OWNER",
        status: "ACTIVE",
        invitedBy: null,
      },
    });
    expect(rpc).toHaveBeenCalledWith(
      "activate_redeemed_brand_membership_atomic",
      {
        p_access_key_id: "access-key-1",
        p_user_id: "profile-1",
      },
    );
  });

  it("rejects an unexpected membership role returned by the database", async () => {
    const single = vi.fn(() =>
      Promise.resolve({
        data: {
          brand_id: "brand-1",
          brand_name: "Helio",
          brand_status: "CREATED",
          membership_id: "membership-1",
          membership_user_id: "profile-1",
          membership_role: "PLATFORM_OWNER",
          membership_status: "ACTIVE",
          membership_invited_by: null,
        },
        error: null,
      }),
    );
    mockedCreateAdminClient.mockReturnValue({
      rpc: vi.fn(() => ({ single })),
    } as never);

    await expect(
      activateRedeemedBrandMembership({
        accessKeyId: "access-key-1",
        userId: "profile-1",
      }),
    ).rejects.toThrow("Unexpected redeemed brand membership state.");
  });
});
