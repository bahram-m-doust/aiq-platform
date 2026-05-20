import { describe, expect, it } from "vitest";

import { toUserProfileInsert } from "@/features/auth/profile-mapping";

describe("user profile mapping", () => {
  it("maps Supabase users to registered profiles", () => {
    const profile = toUserProfileInsert({
      id: "11111111-1111-1111-1111-111111111111",
      email: "OWNER@EXAMPLE.COM",
      user_metadata: {
        full_name: " Brand Owner ",
      },
    } as unknown as Parameters<typeof toUserProfileInsert>[0]);

    expect(profile).toEqual({
      auth_user_id: "11111111-1111-1111-1111-111111111111",
      email: "owner@example.com",
      full_name: "Brand Owner",
      global_role: "REGISTERED_USER",
    });
  });
});
