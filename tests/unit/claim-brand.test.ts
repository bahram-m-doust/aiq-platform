import { describe, expect, it } from "vitest";

import { validateAccessKeyForRedemption } from "@/features/access/access-key-rules";
import type { AccessKeySafeRecord } from "@/features/access/types";
import {
  findCurrentActiveBrandEntitlement,
  toBrandClaimedAudit,
  validateClaimableBrandAvailability,
  validateClaimBrandAccessKey,
} from "@/features/brands/claim-brand/schema";
import type {
  ClaimBrandEntitlementRecord,
  ClaimBrandMembershipRecord,
  ClaimBrandRecord,
} from "@/features/brands/claim-brand/types";

const now = new Date("2026-05-16T12:00:00.000Z");

function claimKey(
  overrides: Partial<AccessKeySafeRecord> = {},
): AccessKeySafeRecord {
  return {
    id: "access-key-1",
    keyPrefix: "bext_example_1",
    type: "CLAIM_BRAND",
    status: "ACTIVE",
    targetEmail: "owner@example.com",
    targetBrandId: "brand-1",
    targetRole: "OWNER",
    planId: null,
    maxRedemptions: 1,
    redeemedCount: 0,
    expiresAt: "2026-06-16T12:00:00.000Z",
    redeemedBy: null,
    redeemedAt: null,
    createdBy: "platform-owner-1",
    createdAt: "2026-05-16T12:00:00.000Z",
    resendEmailId: null,
    ...overrides,
  };
}

function entitlement(
  overrides: Partial<ClaimBrandEntitlementRecord> = {},
): ClaimBrandEntitlementRecord {
  return {
    id: "entitlement-1",
    brandId: "brand-1",
    planId: "plan-1",
    status: "ACTIVE",
    startsAt: "2026-05-01T00:00:00.000Z",
    expiresAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("claim brand access key validation", () => {
  it("requires a CLAIM_BRAND key with target brand and OWNER role", () => {
    expect(validateClaimBrandAccessKey(claimKey())).toBeNull();

    expect(validateClaimBrandAccessKey(claimKey({ type: "JOIN_BRAND" }))).toEqual({
      ok: false,
      code: "UNSUPPORTED_KEY_TYPE",
      message: "This access key cannot claim a brand.",
    });

    expect(
      validateClaimBrandAccessKey(claimKey({ targetBrandId: null })),
    ).toEqual({
      ok: false,
      code: "INVALID_KEY_CONFIGURATION",
      message: "This access key is missing a target brand.",
    });

    expect(
      validateClaimBrandAccessKey(claimKey({ targetRole: "BRAND_SPECIALIST" })),
    ).toEqual({
      ok: false,
      code: "INVALID_KEY_CONFIGURATION",
      message: "CLAIM_BRAND keys must grant Owner access.",
    });
  });

  it("keeps generic redemption checks for wrong email and already redeemed keys", () => {
    expect(
      validateAccessKeyForRedemption({
        accessKey: claimKey(),
        userEmail: "other@example.com",
        now,
      })?.code,
    ).toBe("EMAIL_MISMATCH");

    expect(
      validateAccessKeyForRedemption({
        accessKey: claimKey({ status: "REDEEMED", redeemedCount: 1 }),
        userEmail: "owner@example.com",
        now,
      })?.code,
    ).toBe("ALREADY_REDEEMED");
  });
});

describe("claim brand target availability", () => {
  const brand: ClaimBrandRecord = {
    id: "brand-1",
    name: "Helio",
    status: "CREATED",
  };

  it("finds an active current entitlement", () => {
    expect(
      findCurrentActiveBrandEntitlement({
        entitlements: [
          entitlement({ id: "expired", expiresAt: "2026-05-01T00:00:00.000Z" }),
          entitlement(),
        ],
        now,
      })?.id,
    ).toBe("entitlement-1");
  });

  it("rejects missing brands and missing or expired entitlements", () => {
    expect(
      validateClaimableBrandAvailability({
        brand: null,
        entitlements: [entitlement()],
        now,
      }),
    ).toEqual({
      ok: false,
      code: "CLAIM_BRAND_NOT_AVAILABLE",
      message: "This brand is not ready to be claimed.",
    });

    expect(
      validateClaimableBrandAvailability({
        brand,
        entitlements: [],
        now,
      })?.code,
    ).toBe("CLAIM_BRAND_NOT_AVAILABLE");

    expect(
      validateClaimableBrandAvailability({
        brand,
        entitlements: [entitlement({ expiresAt: "2026-05-01T00:00:00.000Z" })],
        now,
      })?.code,
    ).toBe("CLAIM_BRAND_NOT_AVAILABLE");
  });
});

describe("claim brand persistence shapes", () => {
  it("builds safe brand claimed audit metadata", () => {
    const membership: ClaimBrandMembershipRecord = {
      id: "membership-1",
      brandId: "brand-1",
      userId: "profile-1",
      role: "OWNER",
      status: "ACTIVE",
    };

    expect(
      toBrandClaimedAudit({
        brand: {
          id: "brand-1",
          name: "Helio",
          status: "CREATED",
        },
        membership,
        accessKey: claimKey(),
      }),
    ).toEqual({
      brand: {
        id: "brand-1",
        name: "Helio",
        status: "CREATED",
      },
      membership: {
        id: "membership-1",
        role: "OWNER",
        status: "ACTIVE",
      },
      access_key: {
        id: "access-key-1",
        key_prefix: "bext_example_1",
        type: "CLAIM_BRAND",
        target_brand_id: "brand-1",
        target_role: "OWNER",
      },
    });
  });
});
