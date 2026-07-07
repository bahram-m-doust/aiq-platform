import { describe, expect, it } from "vitest";

import {
  isActiveBrandEntitlement,
  resolveBrandAccessSummary,
} from "@/features/access/access-summary";
import { isPlatformOwnerRole } from "@/features/auth/roles";

const now = new Date("2026-05-16T12:00:00.000Z");

describe("brand access summary", () => {
  it("requires a matching active membership and active entitlement", () => {
    const summary = resolveBrandAccessSummary({
      now,
      memberships: [
        {
          brandId: "brand-1",
          brandName: "AIQ STUDIO",
          role: "OWNER",
        },
      ],
      entitlements: [
        {
          brandId: "brand-1",
          status: "ACTIVE",
          startsAt: "2026-01-01T00:00:00.000Z",
          expiresAt: null,
          planName: "BASIC",
          credits: 1000,
        },
      ],
    });

    expect(summary).toEqual({
      status: "ACTIVE_ACCESS",
      brandId: "brand-1",
      brandName: "AIQ STUDIO",
      membershipRole: "OWNER",
      planName: "BASIC",
      credits: 1000,
    });
  });

  it("returns no access without an active entitlement", () => {
    const summary = resolveBrandAccessSummary({
      now,
      memberships: [
        {
          brandId: "brand-1",
          brandName: "AIQ STUDIO",
          role: "OWNER",
        },
      ],
      entitlements: [
        {
          brandId: "brand-1",
          status: "EXPIRED",
          startsAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-02-01T00:00:00.000Z",
          planName: "BASIC",
          credits: 0,
        },
      ],
    });

    expect(summary.status).toBe("NO_ACCESS");
    expect(summary.brandId).toBeNull();
  });

  it("treats future and expired entitlement windows as inactive", () => {
    expect(
      isActiveBrandEntitlement(
        {
          brandId: "brand-1",
          status: "ACTIVE",
          startsAt: "2026-06-01T00:00:00.000Z",
          expiresAt: null,
          planName: "BASIC",
          credits: 0,
        },
        now,
      ),
    ).toBe(false);

    expect(
      isActiveBrandEntitlement(
        {
          brandId: "brand-1",
          status: "ACTIVE",
          startsAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-05-01T00:00:00.000Z",
          planName: "BASIC",
          credits: 0,
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("admin role checks", () => {
  it("allows only Platform Owner global role for admin", () => {
    expect(isPlatformOwnerRole("PLATFORM_OWNER")).toBe(true);
    expect(isPlatformOwnerRole("REGISTERED_USER")).toBe(false);
    expect(isPlatformOwnerRole(null)).toBe(false);
  });
});
