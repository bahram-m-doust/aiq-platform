import { describe, expect, it } from "vitest";

import {
  toEndOfDayUtcIso,
  toStartOfDayUtcIso,
  validateManualGrantFormData,
} from "@/features/admin/manual-grant/schema";
import { formData } from "@/tests/helpers/formData";

describe("manual grant validation", () => {
  it("accepts valid manual grant input and normalizes dates/text", () => {
    const result = validateManualGrantFormData(
      formData({
        brand_id: "brand-1",
        plan_id: "plan-1",
        source: "BANK_TRANSFER",
        starts_at: "2026-05-16",
        expires_at: "2026-06-16",
        manual_reference: "  wire-100  ",
        internal_note: "  paid outside Stripe  ",
      }),
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      brandId: "brand-1",
      planId: "plan-1",
      source: "BANK_TRANSFER",
      startsAt: "2026-05-16T00:00:00.000Z",
      expiresAt: "2026-06-16T23:59:59.999Z",
      manualReference: "wire-100",
      internalNote: "paid outside Stripe",
    });
  });

  it("requires brand, plan, supported manual source, and valid dates", () => {
    expect(
      validateManualGrantFormData(
        formData({
          plan_id: "plan-1",
          source: "DEMO",
          starts_at: "2026-05-16",
          expires_at: "2026-06-16",
        }),
      ).error,
    ).toBe("Choose a brand.");

    expect(
      validateManualGrantFormData(
        formData({
          brand_id: "brand-1",
          source: "DEMO",
          starts_at: "2026-05-16",
          expires_at: "2026-06-16",
        }),
      ).error,
    ).toBe("Choose a plan.");

    expect(
      validateManualGrantFormData(
        formData({
          brand_id: "brand-1",
          plan_id: "plan-1",
          source: "STRIPE",
          starts_at: "2026-05-16",
          expires_at: "2026-06-16",
        }),
      ).error,
    ).toBe("Choose a supported grant source.");
  });

  it("requires expiry after start date", () => {
    expect(
      validateManualGrantFormData(
        formData({
          brand_id: "brand-1",
          plan_id: "plan-1",
          source: "DEMO",
          starts_at: "2026-06-16",
          expires_at: "2026-06-15",
        }),
      ).error,
    ).toBe("Expiry date must be after start date.");
  });

  it("converts date inputs to UTC day bounds", () => {
    expect(toStartOfDayUtcIso("2026-05-16")).toBe(
      "2026-05-16T00:00:00.000Z",
    );
    expect(toEndOfDayUtcIso("2026-05-16")).toBe(
      "2026-05-16T23:59:59.999Z",
    );
    expect(toStartOfDayUtcIso("not-a-date")).toBeNull();
  });
});
