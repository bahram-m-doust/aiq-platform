import type { User } from "@supabase/supabase-js";

import type { UserProfileInsert } from "@/features/auth/types";

export function toUserProfileInsert(user: User): UserProfileInsert {
  const email = user.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("Authenticated user is missing an email address.");
  }

  const metadataFullName = user.user_metadata?.full_name;
  const fullName =
    typeof metadataFullName === "string" && metadataFullName.trim()
      ? metadataFullName.trim()
      : null;

  return {
    auth_user_id: user.id,
    email,
    full_name: fullName,
    global_role: "REGISTERED_USER",
  };
}
