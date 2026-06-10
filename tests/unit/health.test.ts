import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/logging/server", () => ({
  logServerError: vi.fn(),
}));

import { getHealthStatus } from "@/lib/health";
import { logServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedLogServerError = vi.mocked(logServerError);

const originalEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  KEY_ENCRYPTION_KEY: process.env.KEY_ENCRYPTION_KEY,
  APP_BASE_URL: process.env.APP_BASE_URL,
  ADMIN_BASE_URL: process.env.ADMIN_BASE_URL,
};

function restoreEnv() {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
}

function setRequiredEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.KEY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.APP_BASE_URL = "https://app.test";
  process.env.ADMIN_BASE_URL = "https://app.test/admin";
}

function supabaseClient(error: unknown = null) {
  const builder = {
    select: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve({ data: [], error })),
  };

  return {
    from: vi.fn(() => builder),
    builder,
  };
}

describe("health status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns ok when env is configured and Supabase responds", async () => {
    setRequiredEnv();
    const client = supabaseClient();
    mockedCreateAdminClient.mockReturnValue(client as never);

    await expect(
      getHealthStatus(new Date("2026-05-22T00:00:00.000Z")),
    ).resolves.toEqual({
      service: "bextudio-platform",
      status: "ok",
      timestamp: "2026-05-22T00:00:00.000Z",
      checks: {
        env: "ok",
        supabase: "ok",
      },
    });
    expect(client.from).toHaveBeenCalledWith("plans");
    expect(client.builder.select).toHaveBeenCalledWith("id");
    expect(client.builder.limit).toHaveBeenCalledWith(1);
  });

  it("returns error without calling Supabase when required env is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const health = await getHealthStatus(
      new Date("2026-05-22T00:00:00.000Z"),
    );

    expect(health).toMatchObject({
      status: "error",
      checks: {
        env: "error",
        supabase: "error",
      },
    });
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns error and logs safely when Supabase check fails", async () => {
    setRequiredEnv();
    mockedCreateAdminClient.mockReturnValue(
      supabaseClient({ message: "connection failed" }) as never,
    );

    const health = await getHealthStatus(
      new Date("2026-05-22T00:00:00.000Z"),
    );

    expect(health).toMatchObject({
      status: "error",
      checks: {
        env: "ok",
        supabase: "error",
      },
    });
    expect(mockedLogServerError).toHaveBeenCalledWith({
      label: "[health] supabase check failed",
      error: { message: "connection failed" },
    });
  });
});
