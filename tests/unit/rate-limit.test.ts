import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import {
  buildRateLimitIdentifier,
  checkRateLimit,
  getRateLimitWindowStart,
  getRequestRateLimitIdentity,
  hashRateLimitIdentifier,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedHeaders = vi.mocked(headers);

describe("rate limit helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes identifiers and hashes them without exposing raw values", () => {
    const identifier = buildRateLimitIdentifier([
      " 203.0.113.10 ",
      " OWNER@Example.COM ",
    ]);
    const hash = hashRateLimitIdentifier(identifier);

    expect(identifier).toBe("203.0.113.10|owner@example.com");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("owner@example.com");
  });

  it("falls back to page one style fixed windows", () => {
    expect(
      getRateLimitWindowStart(
        new Date("2026-05-22T12:34:56.789Z"),
        60,
      ).toISOString(),
    ).toBe("2026-05-22T12:34:00.000Z");
  });

  it("increments the Supabase-backed bucket and allows requests under limit", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: 2, error: null }));
    mockedCreateAdminClient.mockReturnValue({ rpc } as never);

    const result = await checkRateLimit({
      bucket: "auth.login",
      identifier: "203.0.113.10|owner@example.com",
      limit: 10,
      windowSeconds: 60,
      now: new Date("2026-05-22T12:34:56.789Z"),
    });

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(2);
    expect(rpc).toHaveBeenCalledWith(
      "increment_rate_limit",
      expect.objectContaining({
        p_bucket: "auth.login",
        p_window_start: "2026-05-22T12:34:00.000Z",
      }),
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("owner@example.com");
  });

  it("rejects requests over the configured limit", async () => {
    mockedCreateAdminClient.mockReturnValue({
      rpc: vi.fn(() => Promise.resolve({ data: 101, error: null })),
    } as never);

    const result = await checkRateLimit({
      bucket: "file.upload",
      identifier: "profile-1",
      limit: 100,
      windowSeconds: 3600,
    });

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(101);
  });

  it("fails closed when the persistent limiter is unavailable", async () => {
    mockedCreateAdminClient.mockReturnValue({
      rpc: vi.fn(() =>
        Promise.resolve({ data: null, error: { message: "database down" } }),
      ),
    } as never);

    const result = await checkRateLimit({
      bucket: "auth.login",
      identifier: "profile-1",
      limit: 10,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(11);
  });

  it("uses Netlify's connection IP instead of spoofable forwarded values", async () => {
    mockedHeaders.mockResolvedValue({
      get: vi.fn((name: string) => {
        if (name === "x-nf-client-connection-ip") return "198.51.100.20";
        if (name === "x-forwarded-for") return "203.0.113.10, 10.0.0.1";
        if (name === "user-agent") return "Vitest";
        return null;
      }),
    } as never);

    await expect(getRequestRateLimitIdentity()).resolves.toEqual({
      clientIp: "198.51.100.20",
      userAgent: "Vitest",
    });
  });
});
