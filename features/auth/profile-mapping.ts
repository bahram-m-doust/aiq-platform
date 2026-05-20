import type { User } from "@supabase/supabase-js";

import type { UserProfileInsert } from "@/features/auth/types";

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractFullName(user: User): string | null {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;

  return (
    readMetadataString(metadata, "full_name") ??
    readMetadataString(metadata, "name")
  );
}

export function toUserProfileInsert(user: User): UserProfileInsert {
  const email = user.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("Authenticated user is missing an email address.");
  }

  return {
    auth_user_id: user.id,
    email,
    full_name: extractFullName(user),
    global_role: "REGISTERED_USER",
  };
}
