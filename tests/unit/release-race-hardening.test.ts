import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/audit/logAudit", () => ({
  logAudit: vi.fn(() => Promise.resolve(true)),
}));

import { activateDemoAccessForUser } from "@/features/access/demo-access-grant";
import type { AccessKeySafeRecord } from "@/features/access/types";
import { revokeUnusedAccessKey } from "@/features/access/services";
import {
  createDemoRequest,
  isDemoRequestError,
} from "@/features/demo-requests/services";
import { createBrandFromCreateBrandAccessKey } from "@/features/brands/create-brand/services";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

function demoAccessKey(): AccessKeySafeRecord {
  return {
    id: "access-key-1",
    keyPrefix: "demo",
    type: "DEMO_ACCESS",
    status: "REDEEMED",
    targetEmail: "member@example.com",
    targetBrandId: "brand-1",
    targetRole: "BRAND_SPECIALIST",
    planId: "plan-1",
    maxRedemptions: 1,
    redeemedCount: 1,
    expiresAt: "2026-07-10T00:00:00.000Z",
    redeemedBy: "member-1",
    redeemedAt: "2026-06-10T00:00:00.000Z",
    createdBy: "owner-1",
    createdAt: "2026-06-10T00:00:00.000Z",
    resendEmailId: null,
  };
}

describe("release race hardening services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates demo membership and entitlements through one RPC", async () => {
    const rpc = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            membership_id: "membership-1",
            membership_brand_id: "brand-1",
            membership_user_id: "member-1",
            membership_role: "BRAND_SPECIALIST",
            membership_status: "ACTIVE",
            entitlement_id: "entitlement-1",
            entitlement_brand_id: "brand-1",
            entitlement_plan_id: "plan-1",
            entitlement_source: "DEMO",
            entitlement_status: "ACTIVE",
            entitlement_starts_at: "2026-06-10T00:00:00.000Z",
            entitlement_expires_at: "2026-07-10T00:00:00.000Z",
            entitlement_granted_by: "member-1",
            entitlement_manual_reference: "access_key:access-key-1",
            entitlement_internal_note:
              "Granted via DEMO_ACCESS key redemption",
            entitlement_created_at: "2026-06-10T00:00:00.000Z",
            included_agent_keys: [],
            matched_agent_keys: [],
            agent_entitlement_count: 0,
          },
        ],
        error: null,
      }),
    );
    const from = vi.fn();
    mockedCreateAdminClient.mockReturnValue({ rpc, from } as never);

    const result = await activateDemoAccessForUser({
      accessKey: demoAccessKey(),
      brandId: "brand-1",
      planId: "plan-1",
      userId: "member-1",
      userEmail: "member@example.com",
      actorRole: "REGISTERED_USER",
    });

    expect(rpc).toHaveBeenCalledWith("activate_demo_access_atomic", {
      p_brand_id: "brand-1",
      p_plan_id: "plan-1",
      p_user_id: "member-1",
      p_role: "BRAND_SPECIALIST",
      p_invited_by: "owner-1",
      p_expires_at: "2026-07-10T00:00:00.000Z",
      p_idempotency_key: "access-key-1",
    });
    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      membership: { id: "membership-1", status: "ACTIVE" },
      entitlement: { id: "entitlement-1", source: "DEMO" },
    });
  });

  it("returns the existing pending demo request as a domain conflict", async () => {
    const rpc = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            request_id: "request-1",
            request_user_id: "member-1",
            request_email: "member@example.com",
            request_message: null,
            request_status: "REQUESTED",
            request_reviewed_by: null,
            request_reviewed_at: null,
            request_resolution_note: null,
            request_approved_access_key_id: null,
            request_created_at: "2026-06-10T00:00:00.000Z",
            request_updated_at: "2026-06-10T00:00:00.000Z",
            created: false,
          },
        ],
        error: null,
      }),
    );
    mockedCreateAdminClient.mockReturnValue({ rpc } as never);

    await expect(
      createDemoRequest({
        profile: {
          id: "member-1",
          auth_user_id: "auth-member-1",
          email: "member@example.com",
          full_name: null,
          global_role: "REGISTERED_USER",
        },
        message: null,
      }),
    ).rejects.toSatisfy(isDemoRequestError);
  });

  it("creates the complete brand workspace through one RPC", async () => {
    const rpc = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            created_brand_id: "brand-1",
            created_brand_name: "Helio",
            created_brand_industry: "Technology",
            created_brand_website: "https://helio.example/",
            created_brand_status: "CREATED",
            created_membership_id: "membership-1",
            created_intake_session_id: "intake-1",
            used_access_key_id: "access-key-1",
            used_access_key_prefix: "create",
            used_plan_id: "plan-1",
            created_module_types: ["Brand Strategy", "Visual Identity"],
            created_module_count: 2,
            entitlement_id: "entitlement-1",
            entitlement_brand_id: "brand-1",
            entitlement_plan_id: "plan-1",
            entitlement_source: "ACCESS_KEY",
            entitlement_status: "ACTIVE",
            entitlement_starts_at: "2026-06-10T00:00:00.000Z",
            entitlement_expires_at: "2026-07-10T00:00:00.000Z",
            entitlement_granted_by: "member-1",
            entitlement_manual_reference: "access_key:access-key-1",
            entitlement_internal_note: null,
            entitlement_created_at: "2026-06-10T00:00:00.000Z",
            included_agent_keys: [],
            matched_agent_keys: [],
            agent_entitlement_count: 0,
          },
        ],
        error: null,
      }),
    );
    const from = vi.fn();
    mockedCreateAdminClient.mockReturnValue({ rpc, from } as never);

    const result = await createBrandFromCreateBrandAccessKey({
      accessKeyId: "access-key-1",
      brandName: "Helio",
      industry: "Technology",
      website: "https://helio.example/",
      userId: "member-1",
      userEmail: "member@example.com",
      actorRole: "REGISTERED_USER",
    });

    expect(rpc).toHaveBeenCalledWith(
      "create_brand_from_access_key_atomic",
      {
        p_access_key_id: "access-key-1",
        p_brand_name: "Helio",
        p_industry: "Technology",
        p_website: "https://helio.example/",
        p_user_id: "member-1",
        p_user_email: "member@example.com",
      },
    );
    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      brandId: "brand-1",
      membershipId: "membership-1",
      intakeSessionId: "intake-1",
      moduleCount: 2,
      entitlement: {
        entitlement: { id: "entitlement-1", source: "ACCESS_KEY" },
      },
    });
  });

  it("revokes a newly created key when its dependent workflow fails", async () => {
    const builder = {
      update: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      select: vi.fn(() => builder),
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: {
            id: "access-key-1",
            key_prefix: "demo",
            type: "DEMO_ACCESS",
            status: "REVOKED",
            target_email: "member@example.com",
            target_brand_id: "brand-1",
            target_role: "BRAND_SPECIALIST",
            plan_id: "plan-1",
            max_redemptions: 1,
            redeemed_count: 0,
            expires_at: "2026-07-10T00:00:00.000Z",
            redeemed_by: null,
            redeemed_at: null,
            created_by: "owner-1",
            created_at: "2026-06-10T00:00:00.000Z",
            resend_email_id: null,
          },
          error: null,
        }),
      ),
    };
    mockedCreateAdminClient.mockReturnValue({
      from: vi.fn(() => builder),
    } as never);

    await expect(
      revokeUnusedAccessKey({
        accessKeyId: "access-key-1",
        actorUserId: "owner-1",
        actorRole: "PLATFORM_OWNER",
      }),
    ).resolves.toBe(true);

    expect(builder.update).toHaveBeenCalledWith({ status: "REVOKED" });
    expect(builder.eq).toHaveBeenCalledWith("status", "ACTIVE");
    expect(builder.eq).toHaveBeenCalledWith("redeemed_count", 0);
  });
});
