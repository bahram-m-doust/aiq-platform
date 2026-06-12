import { canViewAdminModulesRole } from "@/features/modules/schema";
import { isUuid } from "@/lib/utils";

// Who sees what: everyone sees notifications addressed directly to them;
// internal users additionally share the INTERNAL_TEAM inbox; brand members
// additionally see their brand's CLIENT notifications (internal-team replies).
// This filter is the single source of truth for "what does this profile see",
// used by the list/count queries and both mark-read writes.
//
// The ids are interpolated into a PostgREST `.or()` filter string, so they
// must be syntactic UUIDs — anything else could smuggle extra filter clauses.
export function notificationAudienceFilter(
  profileId: string,
  globalRole: string | null,
  brandId: string | null,
): string {
  if (!isUuid(profileId)) {
    throw new Error("notificationAudienceFilter requires a UUID profile id.");
  }
  const clauses = [`recipient_id.eq.${profileId}`];
  if (canViewAdminModulesRole(globalRole)) {
    clauses.push("audience.eq.INTERNAL_TEAM");
  }
  if (brandId) {
    if (!isUuid(brandId)) {
      throw new Error("notificationAudienceFilter requires a UUID brand id.");
    }
    clauses.push(`and(audience.eq.CLIENT,brand_id.eq.${brandId})`);
  }
  return clauses.join(",");
}
