import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  ensureUserProfile,
  ensureUserProfileExists,
  logProfileProvisioningError,
} from "@/features/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};

const authUserId = "11111111-1111-1111-1111-111111111111";
const profileId = "22222222-2222-2222-2222-222222222222";

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: authUserId,
    email: "OWNER@EXAMPLE.COM",
    user_metadata: {
      full_name: " Brand Owner ",
    },
    ...overrides,
  } as unknown as Parameters<typeof ensureUserProfile>[0];
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: profileId,
    auth_user_id: authUserId,
    email: "owner@example.com",
    full_name: "Brand Owner",
    global_role: "PLATFORM_OWNER",
    ...overrides,
  };
}

function builder({
  maybeSingle,
  single,
}: {
  maybeSingle?: unknown;
  single?: unknown;
} = {}): Builder {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(maybeSingle)),
    single: vi.fn(() => Promise.resolve(single)),
    update: vi.fn(() => query),
    upsert: vi.fn(() => query),
  } as Builder;

  return query;
}

function setupAdmin(builders: Builder[]) {
  const from = vi.fn(() => {
    const nextBuilder = builders.shift();

    if (!nextBuilder) {
      throw new Error("Unexpected Supabase query.");
    }

    return nextBuilder;
  });

  mockedCreateAdminClient.mockReturnValue({ from } as never);

  return { from };
}

describe("profile provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and updates an existing profile by auth_user_id, not profile id", async () => {
    const selectProfile = builder({
      maybeSingle: { data: profile(), error: null },
    });
    const updateProfile = builder({
      single: { data: profile({ full_name: "Brand Owner" }), error: null },
    });

    setupAdmin([selectProfile, updateProfile]);

    const result = await ensureUserProfile(user());

    expect(result.id).toBe(profileId);
    expect(result.auth_user_id).toBe(authUserId);
    expect(selectProfile.eq).toHaveBeenCalledWith("auth_user_id", authUserId);
    expect(updateProfile.eq).toHaveBeenCalledWith("auth_user_id", authUserId);
    expect(updateProfile.eq).not.toHaveBeenCalledWith("id", authUserId);
    expect(updateProfile.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ global_role: "REGISTERED_USER" }),
    );
  });

  it("returns an existing profile for fast login without refreshing it", async () => {
    const selectProfile = builder({
      maybeSingle: { data: profile(), error: null },
    });
    const { from } = setupAdmin([selectProfile]);

    const result = await ensureUserProfileExists(user());

    expect(result.id).toBe(profileId);
    expect(selectProfile.eq).toHaveBeenCalledWith("auth_user_id", authUserId);
    expect(selectProfile.update).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("creates a missing profile for fast login with an upsert on auth_user_id", async () => {
    const selectProfile = builder({
      maybeSingle: { data: null, error: null },
    });
    const upsertProfile = builder({
      single: {
        data: profile({ global_role: "REGISTERED_USER" }),
        error: null,
      },
    });

    setupAdmin([selectProfile, upsertProfile]);

    const result = await ensureUserProfileExists(user());

    expect(result.auth_user_id).toBe(authUserId);
    expect(upsertProfile.upsert).toHaveBeenCalledWith(
      {
        auth_user_id: authUserId,
        email: "owner@example.com",
        full_name: "Brand Owner",
        global_role: "REGISTERED_USER",
      },
      { onConflict: "auth_user_id" },
    );
  });

  it("normalizes null global_role to REGISTERED_USER for existing profiles", async () => {
    const selectProfile = builder({
      maybeSingle: {
        data: profile({ global_role: null }),
        error: null,
      },
    });
    const updateProfile = builder({
      single: {
        data: profile({ global_role: null }),
        error: null,
      },
    });

    setupAdmin([selectProfile, updateProfile]);

    const result = await ensureUserProfile(user());

    expect(result.global_role).toBe("REGISTERED_USER");
    expect(updateProfile.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ global_role: "REGISTERED_USER" }),
    );
  });

  it("preserves an existing Platform Owner role", async () => {
    const selectProfile = builder({
      maybeSingle: {
        data: profile({ global_role: "PLATFORM_OWNER" }),
        error: null,
      },
    });
    const updateProfile = builder({
      single: {
        data: profile({ global_role: "PLATFORM_OWNER" }),
        error: null,
      },
    });

    setupAdmin([selectProfile, updateProfile]);

    const result = await ensureUserProfile(user());

    expect(result.global_role).toBe("PLATFORM_OWNER");
    expect(updateProfile.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ global_role: "REGISTERED_USER" }),
    );
  });

  it("returns an existing profile when the optional refresh update fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const selectProfile = builder({
      maybeSingle: { data: profile(), error: null },
    });
    const updateProfile = builder({
      single: {
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not query the database for the schema cache. Retrying.",
          details: "schema cache refresh failed",
          hint: "try again later",
        },
      },
    });

    setupAdmin([selectProfile, updateProfile]);

    const result = await ensureUserProfile(user());

    expect(result.id).toBe(profileId);
    expect(result.auth_user_id).toBe(authUserId);
    expect(result.global_role).toBe("PLATFORM_OWNER");
    expect(consoleError).toHaveBeenCalledWith(
      "[auth.profile] profile query failed",
      expect.objectContaining({
        context: "ensureUserProfile.existingProfileRefresh",
        table: "users_profile",
        action: "update",
        query: "users_profile.update.by_auth_user_id",
        auth_user_id: authUserId,
        email_present: true,
        error: expect.objectContaining({
          code: "PGRST202",
          message: "Could not query the database for the schema cache. Retrying.",
          details: "schema cache refresh failed",
          hint: "try again later",
        }),
      }),
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    consoleError.mockRestore();
  });

  it("does not fail existing profile provisioning when the auth payload omits email", async () => {
    const selectProfile = builder({
      maybeSingle: { data: profile(), error: null },
    });
    const updateProfile = builder({
      single: { data: profile(), error: null },
    });

    setupAdmin([selectProfile, updateProfile]);

    const result = await ensureUserProfile(user({ email: undefined }));

    expect(result.id).toBe(profileId);
    expect(updateProfile.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ email: expect.any(String) }),
    );
  });

  it("creates a missing profile with an upsert on auth_user_id", async () => {
    const selectProfile = builder({
      maybeSingle: { data: null, error: null },
    });
    const upsertProfile = builder({
      single: {
        data: profile({ global_role: "REGISTERED_USER" }),
        error: null,
      },
    });

    setupAdmin([selectProfile, upsertProfile]);

    const result = await ensureUserProfile(user());

    expect(result.auth_user_id).toBe(authUserId);
    expect(upsertProfile.upsert).toHaveBeenCalledWith(
      {
        auth_user_id: authUserId,
        email: "owner@example.com",
        full_name: "Brand Owner",
        global_role: "REGISTERED_USER",
      },
      { onConflict: "auth_user_id" },
    );
  });

  it("returns a fallback existing profile when upsert fails after a race", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const selectProfile = builder({
      maybeSingle: { data: null, error: null },
    });
    const upsertProfile = builder({
      single: {
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not query the database for the schema cache. Retrying.",
        },
      },
    });
    const fallbackSelect = builder({
      maybeSingle: { data: profile({ global_role: null }), error: null },
    });

    setupAdmin([selectProfile, upsertProfile, fallbackSelect]);

    const result = await ensureUserProfile(user());

    expect(result.id).toBe(profileId);
    expect(result.global_role).toBe("REGISTERED_USER");
    expect(fallbackSelect.eq).toHaveBeenCalledWith("auth_user_id", authUserId);
    expect(consoleError).toHaveBeenCalledWith(
      "[auth.profile] profile query failed",
      expect.objectContaining({
        context: "ensureUserProfile.upsert",
        table: "users_profile",
        action: "upsert",
        query: "users_profile.upsert.on_auth_user_id",
        auth_user_id: authUserId,
        email_present: true,
      }),
    );

    consoleError.mockRestore();
  });

  it("retries existing profile updates without updated_at when an older table shape rejects it", async () => {
    const selectProfile = builder({
      maybeSingle: { data: profile(), error: null },
    });
    const updateWithTimestamp = builder({
      single: {
        data: null,
        error: {
          code: "PGRST204",
          message: "Could not find the 'updated_at' column of 'users_profile'",
        },
      },
    });
    const retryUpdate = builder({
      single: { data: profile({ email: "owner@example.com" }), error: null },
    });

    setupAdmin([selectProfile, updateWithTimestamp, retryUpdate]);

    const result = await ensureUserProfile(user());

    expect(result.id).toBe(profileId);
    expect(updateWithTimestamp.update).toHaveBeenCalledWith(
      expect.objectContaining({ updated_at: expect.any(String) }),
    );
    expect(retryUpdate.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ updated_at: expect.any(String) }),
    );
    expect(retryUpdate.eq).toHaveBeenCalledWith("auth_user_id", authUserId);
  });

  it("logs profile provisioning errors with safe fields", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    logProfileProvisioningError({
      context: "login",
      error: {
        code: "PGRST202",
        message: "Could not query the database for the schema cache. Retrying.",
        details: "safe details",
        hint: "safe hint",
      },
      user: {
        id: authUserId,
        email: "owner@example.com",
      } as never,
    });

    expect(consoleError).toHaveBeenCalledWith(
      "[auth.profile] profile provisioning failed",
      expect.objectContaining({
        context: "login",
        auth_user_id: authUserId,
        email_present: true,
        error: expect.objectContaining({
          code: "PGRST202",
          message: "Could not query the database for the schema cache. Retrying.",
          details: "safe details",
          hint: "safe hint",
        }),
      }),
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("password");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("service_role");

    consoleError.mockRestore();
  });
});
