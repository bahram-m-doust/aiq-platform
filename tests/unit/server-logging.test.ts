import { describe, expect, it, vi } from "vitest";

import {
  isSensitiveServerLogKey,
  logServerError,
  sanitizeServerLogMetadata,
} from "@/lib/logging/server";

describe("safe server logging", () => {
  it("detects sensitive server log keys", () => {
    expect(isSensitiveServerLogKey("raw_access_key")).toBe(true);
    expect(isSensitiveServerLogKey("signed_download_url")).toBe(true);
    expect(isSensitiveServerLogKey("target_email")).toBe(true);
    expect(isSensitiveServerLogKey("profile_id")).toBe(false);
  });

  it("redacts secrets, emails, prompts, answers, and signed URLs", () => {
    const sanitized = sanitizeServerLogMetadata({
      profileId: "profile-1",
      targetEmail: "owner@example.com",
      rawKey: "bext_raw_secret_key",
      signedUrl: "https://storage.example/signed?token=secret",
      prompt: "Tell me the answer.",
      answer: "The answer.",
    });
    const json = JSON.stringify(sanitized);

    expect(json).toContain("profile-1");
    expect(json).not.toContain("owner@example.com");
    expect(json).not.toContain("bext_raw_secret_key");
    expect(json).not.toContain("token=secret");
    expect(json).not.toContain("Tell me the answer");
    expect(json).not.toContain("The answer");
  });

  it("logs only sanitized context", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    logServerError({
      label: "[test] failed",
      error: {
        code: "PGRST123",
        message: "Safe failure for owner@example.com",
      },
      metadata: {
        profileId: "profile-1",
        userEmail: "owner@example.com",
        token: "secret-token",
      },
    });

    expect(consoleError).toHaveBeenCalledWith(
      "[test] failed",
      expect.objectContaining({
        profileId: "profile-1",
        userEmail: "[REDACTED]",
        token: "[REDACTED]",
        error: expect.objectContaining({
          code: "PGRST123",
          message: "Safe failure for [REDACTED]",
        }),
      }),
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "owner@example.com",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "secret-token",
    );

    consoleError.mockRestore();
  });
});
