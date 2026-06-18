import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/logging/server", () => ({
  logServerError: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminModuleBrandGroups } from "@/features/modules/queries";
import type { UserProfile } from "@/features/auth/types";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

// A chainable, awaitable PostgREST-style query builder that resolves to `result`.
function builder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {
    select: () => b,
    order: () => b,
    in: () => b,
    eq: () => b,
    maybeSingle: () => Promise.resolve(result),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected as never),
  };
  return b;
}

const BRAND_ID = "11111111-1111-1111-1111-111111111111";
const MODULE_ID = "22222222-2222-2222-2222-222222222222";

function owner(): UserProfile {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    auth_user_id: "auth-owner",
    email: "owner@example.com",
    full_name: "Owner",
    global_role: "PLATFORM_OWNER",
  };
}

const moduleRow = {
  id: MODULE_ID,
  brand_id: BRAND_ID,
  module_type: "BRAND_STRATEGY",
  title: "City Model",
  status: "NOT_STARTED",
  assigned_to: null,
  supervisor_id: null,
  current_version: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminModuleBrandGroups resilience", () => {
  it("still renders the module list when the brand enrichment query fails (22P02)", async () => {
    const from = vi.fn((table: string) => {
      if (table === "brand_modules") {
        return builder({ data: [moduleRow], error: null });
      }
      if (table === "brands") {
        // Simulate the enrichment lookup blowing up the way a 22P02 would.
        return builder({
          data: null,
          error: { code: "22P02", message: "invalid input syntax for type uuid" },
        });
      }
      // users_profile / module_artifacts — not reached once enrichment throws.
      return builder({ data: [], error: null });
    });
    mockedCreateAdminClient.mockReturnValue({ from } as never);

    const board = await getAdminModuleBrandGroups(owner());

    // The board must render (not throw), degrading the brand name gracefully.
    expect(board).not.toBeNull();
    expect(board?.groups).toHaveLength(1);
    expect(board?.groups[0]?.modules[0]?.id).toBe(MODULE_ID);
    expect(board?.groups[0]?.modules[0]?.title).toBe("City Model");
    expect(board?.groups[0]?.brandName).toBe("Unknown brand");
  });

  it("renders enriched data on the happy path", async () => {
    const from = vi.fn((table: string) => {
      if (table === "brand_modules") {
        return builder({ data: [moduleRow], error: null });
      }
      if (table === "brands") {
        return builder({ data: [{ id: BRAND_ID, name: "Helio" }], error: null });
      }
      if (table === "module_artifacts") {
        return builder({ data: [], error: null });
      }
      return builder({ data: [], error: null });
    });
    mockedCreateAdminClient.mockReturnValue({ from } as never);

    const board = await getAdminModuleBrandGroups(owner());

    expect(board?.groups[0]?.brandName).toBe("Helio");
    expect(board?.groups[0]?.modules[0]?.title).toBe("City Model");
    // No brand selected → artifacts are not enriched (the page only displays
    // one brand at a time, so enrichment is scoped to selectedBrandId).
    expect(board?.groups[0]?.modules[0]?.latestArtifact).toBeNull();
  });
});
