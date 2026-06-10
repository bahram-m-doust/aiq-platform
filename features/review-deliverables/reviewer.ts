import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { canReviewDeliverableRole } from "@/features/review-deliverables/schema";

export type DeliverableReviewer = {
  profileId: string;
  brandId: string;
  authorName: string | null;
  authorEmail: string | null;
};

// Resolves the signed-in client reviewer for a brand deliverable (stakeholder
// interviews, futures research, city model), or null if they can't review.
// Shared by every deliverable feature so the access check lives in one place.
export async function requireDeliverableReviewer(
  returnTo: string,
): Promise<DeliverableReviewer | null> {
  const { profile } = await requireUserProfile(returnTo);
  const access = await getBrandAccessSummaryForProfile(profile.id);
  if (
    access.status !== "ACTIVE_ACCESS" ||
    !access.brandId ||
    !canReviewDeliverableRole(access.membershipRole)
  ) {
    return null;
  }
  return {
    profileId: profile.id,
    brandId: access.brandId,
    authorName: profile.full_name ?? null,
    authorEmail: profile.email ?? null,
  };
}
