import { afterEach, describe, expect, it } from "vitest";

import {
  buildAdminAccessKeySuccessState,
  toEndOfDayUtcIso,
  validateAdminAccessKeyFormData,
} from "@/features/admin/access-key-schema";
import type { AccessKeySafeRecord } from "@/features/access/types";
import { getResendEmailConfig } from "@/lib/email/sendEmail";
import { buildAccessKeyEmail } from "@/lib/email/templates";
import { formData } from "@/tests/helpers/formData";

const originalResendApiKey = process.env.RESEND_API_KEY;
const originalEmailFrom = process.env.EMAIL_FROM;

function safeAccessKey(): AccessKeySafeRecord {
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
    expiresAt: "2099-01-01T23:59:59.999Z",
    redeemedBy: null,
    redeemedAt: null,
    createdBy: "platform-owner-1",
    createdAt: "2026-05-16T12:00:00.000Z",
    resendEmailId: null,
  };
}

afterEach(() => {
  process.env.RESEND_API_KEY = originalResendApiKey;
  process.env.EMAIL_FROM = originalEmailFrom;
});

describe("admin access key form validation", () => {
  it("accepts a create brand key with normalized email and end-of-day expiry", () => {
    const result = validateAdminAccessKeyFormData(
      formData({
        type: "CREATE_BRAND",
        target_email: " OWNER@EXAMPLE.COM ",
        plan_id: "plan-1",
        expires_at: "2099-01-01",
        send_email: true,
      }),
    );

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      type: "CREATE_BRAND",
      targetEmail: "owner@example.com",
      targetBrandId: null,
      targetRole: null,
      planId: "plan-1",
      expiresAt: "2099-01-01T23:59:59.999Z",
      sendEmail: true,
    });
  });

  it("requires brand and role for claim and join keys", () => {
    expect(
      validateAdminAccessKeyFormData(
        formData({
          type: "CLAIM_BRAND",
          target_email: "owner@example.com",
          expires_at: "2099-01-01",
        }),
      ).error,
    ).toBe("Choose a target brand for this key type.");

    expect(
      validateAdminAccessKeyFormData(
        formData({
          type: "JOIN_BRAND",
          target_email: "owner@example.com",
          target_brand_id: "brand-1",
          expires_at: "2099-01-01",
        }),
      ).error,
    ).toBe("Choose a target role for this key type.");
  });

  it("excludes unsupported admin key types", () => {
    expect(
      validateAdminAccessKeyFormData(
        formData({
          type: "SUPPORT_ACCESS",
          target_email: "owner@example.com",
          expires_at: "2099-01-01",
        }),
      ).error,
    ).toBe("Choose a supported access key type.");
  });

  it("converts expiry dates to end-of-day UTC", () => {
    expect(toEndOfDayUtcIso("2099-01-01")).toBe(
      "2099-01-01T23:59:59.999Z",
    );
    expect(toEndOfDayUtcIso("not-a-date")).toBeNull();
  });
});

describe("admin access key email handling", () => {
  it("returns a controlled error when Resend config is missing", () => {
    process.env.RESEND_API_KEY = "";
    process.env.EMAIL_FROM = "no-reply@example.com";

    expect(getResendEmailConfig()).toEqual({
      ok: false,
      code: "MISSING_RESEND_API_KEY",
      message: "Email sending is not configured. Add RESEND_API_KEY.",
    });
  });

  it("keeps the raw key out of the email subject", () => {
    const rawKey = "bext_raw_key_once";
    const redeemUrl = "https://bextudio.test/home?key=bext_raw_key_once";
    const email = buildAccessKeyEmail({
      rawKey,
      redeemUrl,
      type: "CREATE_BRAND",
      expiresAt: "2099-01-01T23:59:59.999Z",
    });

    expect(email.subject).not.toContain(rawKey);
    expect(email.text).toContain(rawKey);
    expect(email.html).toContain(rawKey);
    expect(email.text).toContain(redeemUrl);
    expect(email.html).toContain(redeemUrl);
  });

  it("does not expose access key hashes in success state", () => {
    const state = buildAdminAccessKeySuccessState({
      rawKey: "bext_raw_key_once",
      accessKey: safeAccessKey(),
      resendEmailId: "email-id-1",
    });

    expect(JSON.stringify(state)).toContain("bext_raw_key_once");
    expect(JSON.stringify(state)).not.toContain("keyHash");
    expect(JSON.stringify(state)).not.toContain("key_hash");
  });
});
