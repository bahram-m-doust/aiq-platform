import { describe, expect, it } from "vitest";

import {
  extractFullName,
  toUserProfileInsert,
} from "@/features/auth/profile-mapping";

type UserShape = Parameters<typeof toUserProfileInsert>[0];

function makeUser(overrides: Partial<UserShape> = {}): UserShape {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    email: "OWNER@EXAMPLE.COM",
    user_metadata: { full_name: " Brand Owner " },
    ...overrides,
  } as UserShape;
}

describe("user profile mapping", () => {
  it("maps Supabase users to registered profiles", () => {
    expect(toUserProfileInsert(makeUser())).toEqual({
      auth_user_id: "11111111-1111-1111-1111-111111111111",
      email: "owner@example.com",
      full_name: "Brand Owner",
      global_role: "REGISTERED_USER",
    });
  });

  it("falls back to user_metadata.name when full_name is missing (Google)", () => {
    const profile = toUserProfileInsert(
      makeUser({
        user_metadata: { name: "Google User" } as Record<string, unknown>,
      } as Partial<UserShape>),
    );

    expect(profile.full_name).toBe("Google User");
  });

  it("prefers full_name over name when both are present", () => {
    expect(
      extractFullName(
        makeUser({
          user_metadata: {
            full_name: "Primary",
            name: "Secondary",
          } as Record<string, unknown>,
        } as Partial<UserShape>),
      ),
    ).toBe("Primary");
  });

  it("returns null when neither full_name nor name are set", () => {
    expect(
      extractFullName(
        makeUser({
          user_metadata: {} as Record<string, unknown>,
        } as Partial<UserShape>),
      ),
    ).toBeNull();
  });

  it("rejects users without an email", () => {
    expect(() =>
      toUserProfileInsert(
        makeUser({ email: undefined } as Partial<UserShape>),
      ),
    ).toThrow(/email/);
  });
});
