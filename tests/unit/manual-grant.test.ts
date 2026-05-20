import { describe, expect, it } from "vitest";

import {
  buildAgentEntitlementUpserts,
  findUnmatchedAgentKeys,
  parseIncludedAgentKeys,
} from "@/features/access/grant-brand-access-rules";
import {
  toEndOfDayUtcIso,
  toStartOfDayUtcIso,
  validateManualGrantFormData,
} from "@/features/admin/manual-grant/schema";

function formData(values: Record<string, string>) {
  const data = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    data.set(key, value);
  });

  return data;
}

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

describe("plan included agent rules", () => {
  it("parses unique string agent keys from plan metadata", () => {
    expect(
      parseIncludedAgentKeys([
        "STORY_TELLER",
        "",
        "STORY_TELLER",
        " IMAGE_GENERATOR ",
        123,
      ]),
    ).toEqual(["STORY_TELLER", "IMAGE_GENERATOR"]);

    expect(parseIncludedAgentKeys(null)).toEqual([]);
  });

  it("builds locked-by-brain agent entitlement upsert rows", () => {
    expect(
      buildAgentEntitlementUpserts({
        brandId: "brand-1",
        planId: "plan-1",
        startsAt: "2026-05-16T00:00:00.000Z",
        expiresAt: "2026-06-16T23:59:59.999Z",
        agents: [{ id: "agent-1", key: "STORY_TELLER" }],
      }),
    ).toEqual([
      {
        brand_id: "brand-1",
        agent_id: "agent-1",
        plan_id: "plan-1",
        status: "LOCKED_BY_BRAIN",
        starts_at: "2026-05-16T00:00:00.000Z",
        expires_at: "2026-06-16T23:59:59.999Z",
      },
    ]);
  });

  it("reports configured agent keys not found in active agents", () => {
    expect(
      findUnmatchedAgentKeys({
        includedAgentKeys: ["STORY_TELLER", "IMAGE_GENERATOR"],
        agents: [{ id: "agent-1", key: "STORY_TELLER" }],
      }),
    ).toEqual(["IMAGE_GENERATOR"]);
  });
});
