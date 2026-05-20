import { describe, expect, it } from "vitest";

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

function formData(values: Record<string, string>) {
  const data = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    data.set(key, value);
  });

  return data;
}

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
    expect(sanitizeRedirectPath("https://example.com")).toBe("/dashboard");
    expect(sanitizeRedirectPath("//example.com")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/invite/accept?key=bext_example")).toBe(
      "/invite/accept?key=bext_example",
    );
  });

  it("identifies admin paths", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/audit")).toBe(true);
    expect(isAdminPath("/admins")).toBe(false);
    expect(isAdminPath("/dashboard")).toBe(false);
  });

  it("routes admin destinations to the admin login page", () => {
    expect(resolveLoginPathForNext("/admin")).toBe("/admin/login");
    expect(resolveLoginPathForNext("/admin/audit")).toBe("/admin/login");
    expect(resolveLoginPathForNext("/admin/login")).toBe("/login");
    expect(resolveLoginPathForNext("/dashboard")).toBe("/login");
    expect(resolveLoginPathForNext("/dashboard/intake")).toBe("/login");
  });
});
