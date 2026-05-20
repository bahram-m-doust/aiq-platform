import type { UserProfile } from "@/features/auth/types";

export function isPlatformOwnerRole(role: string | null | undefined) {
  return role === "PLATFORM_OWNER";
}

export function isPlatformOwnerProfile(
  profile: Pick<UserProfile, "global_role">,
) {
  return isPlatformOwnerRole(profile.global_role);
}
