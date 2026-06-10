import "server-only";

import { getIntakeAccessForProfile } from "@/features/questionnaire/queries";
import { canInviteSpecialistRole } from "@/features/invitations/schema";
import type { SpecialistInvitationContext } from "@/features/invitations/types";

export async function getSpecialistInvitationContext(
  profileId: string,
): Promise<SpecialistInvitationContext | null> {
  const access = await getIntakeAccessForProfile({ profileId });

  if (!access || !canInviteSpecialistRole(access.membershipRole)) {
    return null;
  }

  return {
    brandId: access.brandId,
    brandName: access.brandName,
    membershipRole: access.membershipRole,
    planName: access.planName,
  };
}
