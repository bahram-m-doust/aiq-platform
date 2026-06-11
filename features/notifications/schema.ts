import { canViewAdminModulesRole } from "@/features/modules/schema";

// Internal users share the INTERNAL_TEAM inbox (plus any directly-addressed
// notifications); everyone else sees only notifications addressed to them.
// This filter is the single source of truth for "what does this profile see",
// used by both the list/count queries and "mark all read".
export function notificationAudienceFilter(
  profileId: string,
  globalRole: string | null,
): string {
  if (canViewAdminModulesRole(globalRole)) {
    return `audience.eq.INTERNAL_TEAM,recipient_id.eq.${profileId}`;
  }
  return `recipient_id.eq.${profileId}`;
}
