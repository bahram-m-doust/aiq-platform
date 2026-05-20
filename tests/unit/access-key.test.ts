import { describe, expect, it } from "vitest";

import {
  buildAccessKeyNextAction,
  failure,
  normalizeAccessKeyEmail,
  validateAccessKeyConfiguration,
  validateAccessKeyForRedemption,
} from "@/features/access/access-key-rules";
import type { AccessKeySafeRecord } from "@/features/access/types";
import { generateAccessKey } from "@/lib/security/generateAccessKey";
import { hashAccessKey } from "@/lib/security/hashAccessKey";

const now = new Date("2026-05-16T12:00:00.000Z");

function accessKey(
  overrides: Partial<AccessKeySafeRecord> = {},
): AccessKeySafeRecord {
  return {
    id: "access-key-1",
    keyPrefix: "bext_example_1",
    type: "CREATE_BRAND",
    status: "ACTIVE",
    targetEmail: "owner@example.com",
    targetBrandId: null,
    targetRole: null,
    planId: "plan-1",
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

describe("access key security helpers", () => {
  it("generates high-entropy keys with a display prefix and hash", () => {
    const first = generateAccessKey();
    const second = generateAccessKey();

    expect(first.rawKey).toMatch(/^bext_[A-Za-z0-9_-]+$/);
    expect(first.rawKey).not.toBe(second.rawKey);
    expect(first.keyPrefix).toBe(first.rawKey.slice(0, 16));
    expect(first.keyHash).toBe(hashAccessKey(first.rawKey));
    expect(first.keyHash).not.toContain(first.rawKey);
  });

  it("hashes normalized access keys deterministically", () => {
    expect(hashAccessKey(" bext_example ")).toBe(hashAccessKey("bext_example"));
    expect(hashAccessKey("bext_example")).toHaveLength(64);
    expect(hashAccessKey("bext_example")).not.toBe("bext_example");
  });
});

describe("access key redemption rules", () => {
  it("normalizes email checks", () => {
    expect(normalizeAccessKeyEmail(" OWNER@EXAMPLE.COM ")).toBe(
      "owner@example.com",
    );
  });

  it("accepts an active, unexpired key bound to the user email", () => {
    expect(
      validateAccessKeyForRedemption({
        accessKey: accessKey(),
        userEmail: " OWNER@EXAMPLE.COM ",
        now,
      }),
    ).toBeNull();
  });

  it("rejects expired, redeemed, and wrong-email keys", () => {
    expect(
      validateAccessKeyForRedemption({
        accessKey: accessKey({ expiresAt: "2026-05-01T00:00:00.000Z" }),
        userEmail: "owner@example.com",
        now,
      })?.code,
    ).toBe("EXPIRED_KEY");

    expect(
      validateAccessKeyForRedemption({
        accessKey: accessKey({ redeemedCount: 1 }),
        userEmail: "owner@example.com",
        now,
      })?.code,
    ).toBe("ALREADY_REDEEMED");

    expect(
      validateAccessKeyForRedemption({
        accessKey: accessKey(),
        userEmail: "other@example.com",
        now,
      })?.code,
    ).toBe("EMAIL_MISMATCH");
  });

  it("requires target brands for claim, join, and support keys", () => {
    expect(
      validateAccessKeyConfiguration(
        accessKey({ type: "JOIN_BRAND", targetBrandId: null }),
      )?.code,
    ).toBe("INVALID_KEY_CONFIGURATION");

    expect(
      validateAccessKeyConfiguration(
        accessKey({ type: "JOIN_BRAND", targetBrandId: "brand-1" }),
      ),
    ).toBeNull();
  });

  it("supports a typed failure for activation steps that reject the key type", () => {
    expect(
      failure(
        "UNSUPPORTED_KEY_TYPE",
        "This access key cannot be used for this activation step.",
      ),
    ).toEqual({
      ok: false,
      code: "UNSUPPORTED_KEY_TYPE",
      message: "This access key cannot be used for this activation step.",
    });
  });

  it("maps redeemed keys to the next product action", () => {
    expect(buildAccessKeyNextAction(accessKey())?.kind).toBe(
      "CREATE_BRAND_REQUIRED",
    );

    expect(
      buildAccessKeyNextAction(
        accessKey({ type: "CLAIM_BRAND", targetBrandId: "brand-1" }),
      ),
    ).toMatchObject({
      kind: "CLAIM_BRAND_REQUIRED",
      targetBrandId: "brand-1",
      planId: "plan-1",
    });

    expect(
      buildAccessKeyNextAction(accessKey({ type: "SUPPORT_ACCESS" })),
    ).toBeNull();
  });
});
