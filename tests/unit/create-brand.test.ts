import { describe, expect, it } from "vitest";

import {
  buildBrandModuleRows,
  calculatePlanGrantExpiresAt,
  normalizeWebsite,
  parseIncludedModuleTypes,
  validateCreateBrandAccessKeyContext,
  validateCreateBrandFormData,
} from "@/features/brands/create-brand/schema";
import type { CreateBrandAccessKeyRecord } from "@/features/brands/create-brand/types";
import { formData } from "@/tests/helpers/formData";

function accessKey(
  overrides: Partial<CreateBrandAccessKeyRecord> = {},
): CreateBrandAccessKeyRecord {
  return {
    id: "access-key-1",
    keyPrefix: "bext_example_1",
    type: "CREATE_BRAND",
    status: "REDEEMED",
    targetEmail: "owner@example.com",
    targetBrandId: null,
    planId: "plan-1",
    expiresAt: "2026-06-16T12:00:00.000Z",
    redeemedBy: "profile-1",
    ...overrides,
  };
}

describe("create brand validation", () => {
  it("accepts valid input and normalizes optional website", () => {
    const result = validateCreateBrandFormData(
      formData({
        access_key_id: "access-key-1",
        brand_name: "  Helio  ",
        industry: "  Hospitality  ",
        website: " https://helio.example/path ",
      }),
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      accessKeyId: "access-key-1",
      brandName: "Helio",
      industry: "Hospitality",
      website: "https://helio.example/path",
    });
  });

  it("requires access key, brand name, industry, and valid website protocol", () => {
    expect(
      validateCreateBrandFormData(
        formData({
          brand_name: "Helio",
          industry: "Hospitality",
        }),
      ).error,
    ).toBe("Access key confirmation is missing.");

    expect(
      validateCreateBrandFormData(
        formData({
          access_key_id: "access-key-1",
          industry: "Hospitality",
        }),
      ).error,
    ).toBe("Enter the brand name.");

    expect(
      validateCreateBrandFormData(
        formData({
          access_key_id: "access-key-1",
          brand_name: "Helio",
        }),
      ).error,
    ).toBe("Enter the industry.");

    expect(
      validateCreateBrandFormData(
        formData({
          access_key_id: "access-key-1",
          brand_name: "Helio",
          industry: "Hospitality",
          website: "ftp://helio.example",
        }),
      ).error,
    ).toBe("Website must be a valid http or https URL.");
  });

  it("normalizes empty, http, and https website values", () => {
    expect(normalizeWebsite("")).toBeNull();
    expect(normalizeWebsite("http://example.com")).toBe("http://example.com/");
    expect(normalizeWebsite("https://example.com")).toBe(
      "https://example.com/",
    );
    expect(normalizeWebsite("example.com")).toBeNull();
  });
});

describe("create brand access key context", () => {
  const now = new Date("2026-05-16T12:00:00.000Z");

  it("accepts a redeemed, unfulfilled CREATE_BRAND key for the current user", () => {
    expect(
      validateCreateBrandAccessKeyContext({
        accessKey: accessKey(),
        profileId: "profile-1",
        userEmail: "OWNER@EXAMPLE.COM",
        now,
      }),
    ).toBeNull();
  });

  it("rejects wrong type, wrong status, fulfilled, expired, and wrong user keys", () => {
    expect(
      validateCreateBrandAccessKeyContext({
        accessKey: accessKey({ type: "JOIN_BRAND" }),
        profileId: "profile-1",
        userEmail: "owner@example.com",
        now,
      }),
    ).toBe("This access key cannot create a brand.");

    expect(
      validateCreateBrandAccessKeyContext({
        accessKey: accessKey({ status: "ACTIVE" }),
        profileId: "profile-1",
        userEmail: "owner@example.com",
        now,
      }),
    ).toBe("Redeem a CREATE_BRAND access key before creating a brand.");

    expect(
      validateCreateBrandAccessKeyContext({
        accessKey: accessKey({ targetBrandId: "brand-1" }),
        profileId: "profile-1",
        userEmail: "owner@example.com",
        now,
      }),
    ).toBe("This CREATE_BRAND key has already been used to create a brand.");

    expect(
      validateCreateBrandAccessKeyContext({
        accessKey: accessKey({ expiresAt: "2026-05-01T00:00:00.000Z" }),
        profileId: "profile-1",
        userEmail: "owner@example.com",
        now,
      }),
    ).toBe("This access key has expired.");

    expect(
      validateCreateBrandAccessKeyContext({
        accessKey: accessKey({ redeemedBy: "profile-2" }),
        profileId: "profile-1",
        userEmail: "owner@example.com",
        now,
      }),
    ).toBe("This access key was redeemed by another user.");
  });
});

describe("create brand plan defaults", () => {
  it("calculates entitlement expiry from plan duration days", () => {
    expect(
      calculatePlanGrantExpiresAt("2026-05-16T12:00:00.000Z", 30),
    ).toBe("2026-06-15T12:00:00.000Z");
    expect(
      calculatePlanGrantExpiresAt("2026-05-16T12:00:00.000Z", null),
    ).toBeNull();
  });

  it("parses included module types and builds default module rows", () => {
    const moduleTypes = parseIncludedModuleTypes([
      "Brand Knowledge",
      "",
      "Brand Knowledge",
      " Visual System ",
      123,
    ]);

    expect(moduleTypes).toEqual(["Brand Knowledge", "Visual System"]);
    expect(
      buildBrandModuleRows({
        brandId: "brand-1",
        moduleTypes,
      }),
    ).toEqual([
      {
        brand_id: "brand-1",
        module_type: "Brand Knowledge",
        title: "Brand Knowledge",
        status: "NOT_STARTED",
      },
      {
        brand_id: "brand-1",
        module_type: "Visual System",
        title: "Visual System",
        status: "NOT_STARTED",
      },
    ]);
  });
});
