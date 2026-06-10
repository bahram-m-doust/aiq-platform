import { describe, expect, it } from "vitest";

import { resolveTrustedAppOrigin } from "@/features/auth/origins";
import {
  isAdminPath,
  resolveLoginPathForNext,
  sanitizeRedirectPath,
} from "@/features/auth/redirects";
import {
  validateEmail,
  validateLoginFormData,
  validateRegistrationFormData,
} from "@/features/auth/schemas";
import { withOriginEnv } from "@/tests/helpers/env";
import { formData } from "@/tests/helpers/formData";

describe("auth validation", () => {
  it("accepts valid email addresses", () => {
    expect(validateEmail("owner@example.com")).toBe(true);
  });

  it("rejects invalid login data", () => {
    const result = validateLoginFormData(
      formData({ email: "not-an-email", password: "" }),
    );

    expect(result.error).toBe("Enter a valid email address.");
    expect(result.data).toBeNull();
  });

  it("normalizes valid login credentials", () => {
    const result = validateLoginFormData(
      formData({ email: " OWNER@EXAMPLE.COM ", password: "secret" }),
    );

    expect(result.data).toEqual({
      email: "owner@example.com",
      password: "secret",
    });
  });

  it("requires a registration password of at least 8 characters", () => {
    const result = validateRegistrationFormData(
      formData({ email: "owner@example.com", password: "short" }),
    );

    expect(result.error).toBe("Use a password with at least 8 characters.");
  });

  it("prevents external redirect targets", () => {
    expect(sanitizeRedirectPath("https://example.com")).toBe("/home");
    expect(sanitizeRedirectPath("//example.com")).toBe("/home");
    expect(sanitizeRedirectPath("/\\evil.example")).toBe("/home");
    expect(sanitizeRedirectPath("/dashboard\n/admin")).toBe("/home");
    expect(sanitizeRedirectPath(" /dashboard")).toBe("/home");
    expect(sanitizeRedirectPath("/home")).toBe("/home");
    expect(sanitizeRedirectPath("/invite/accept?key=bext_example")).toBe(
      "/invite/accept?key=bext_example",
    );
  });

  it("allows only configured origins for auth callback URLs", () => {
    withOriginEnv(
      {
        appBaseUrl: "https://app.bextudio.test",
        adminBaseUrl: "https://admin.bextudio.test",
      },
      () => {
        const maliciousOrigin = "https://evil.example";
        const resolvedOrigin = resolveTrustedAppOrigin(maliciousOrigin);
        const callbackUrl = new URL("/callback", resolvedOrigin);

        expect(resolvedOrigin).toBe("https://app.bextudio.test");
        expect(callbackUrl.toString()).toBe(
          "https://app.bextudio.test/callback",
        );
        expect(resolveTrustedAppOrigin("https://admin.bextudio.test")).toBe(
          "https://admin.bextudio.test",
        );
      },
    );
  });

  it("identifies admin paths", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/audit")).toBe(true);
    expect(isAdminPath("/admins")).toBe(false);
    expect(isAdminPath("/home")).toBe(false);
  });

  it("routes admin destinations to the admin login page", () => {
    expect(resolveLoginPathForNext("/admin")).toBe("/admin/login");
    expect(resolveLoginPathForNext("/admin/audit")).toBe("/admin/login");
    expect(resolveLoginPathForNext("/admin/login")).toBe("/login");
    expect(resolveLoginPathForNext("/home")).toBe("/login");
    expect(resolveLoginPathForNext("/intake")).toBe("/login");
  });
});
