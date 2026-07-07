"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  redeemAccessKey,
  rollbackAccessKeyRedemption,
} from "@/features/access/services";
import { getTrustedRequestOrigin } from "@/features/auth/origins";
import { requireUserProfile } from "@/features/auth/queries";
import {
  validateAcceptInvitationFormData,
  validateSpecialistInvitationFormData,
} from "@/features/invitations/schema";
import {
  acceptSpecialistInvitationForRedeemedAccessKey,
  createSpecialistInvitation,
  isInvitationError,
  validateJoinBrandBeforeRedeem,
} from "@/features/invitations/services";
import type {
  AcceptInvitationFormState,
  SpecialistInvitationFormState,
} from "@/features/invitations/types";
import { logServerError } from "@/lib/logging/server";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";

function invitationErrorState(message: string): SpecialistInvitationFormState {
  return { status: "error", message };
}

function acceptErrorState(message: string): AcceptInvitationFormState {
  return { status: "error", message };
}

export async function createSpecialistInvitationAction(
  _previousState: SpecialistInvitationFormState,
  formData: FormData,
): Promise<SpecialistInvitationFormState> {
  const { user, profile } = await requireUserProfile("/invitations");
  const validation = validateSpecialistInvitationFormData(formData);

  if (validation.error || !validation.data) {
    return invitationErrorState(
      validation.error ?? "Invitation details are invalid.",
    );
  }

  const rateLimit = await checkRequestRateLimit({
    bucket: "invitation.create",
    identifiers: [profile.id, validation.data.targetEmail],
    limit: 10,
    windowSeconds: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return invitationErrorState(RATE_LIMITED_MESSAGE);
  }

  try {
    const result = await createSpecialistInvitation({
      input: validation.data,
      inviterProfileId: profile.id,
      inviterEmail: user.email ?? profile.email,
      appOrigin: await getTrustedRequestOrigin(),
    });

    revalidatePath("/invitations");

    return {
      status: "success",
      message: result.warning
        ? "Invitation key created. Review the delivery warning below."
        : "Invitation email sent.",
      ...result,
    };
  } catch (error) {
    if (isInvitationError(error)) {
      return invitationErrorState(error.message);
    }

    logServerError({
      label: "[invitations] create failed",
      error,
      metadata: {
        inviterProfileId: profile.id,
        targetEmail: validation.data.targetEmail,
      },
    });

    return invitationErrorState("Invitation could not be created.");
  }
}

export async function acceptSpecialistInvitationAction(
  _previousState: AcceptInvitationFormState,
  formData: FormData,
): Promise<AcceptInvitationFormState> {
  const validation = validateAcceptInvitationFormData(formData);

  if (validation.error || !validation.data) {
    return acceptErrorState(validation.error ?? "Invitation key is invalid.");
  }

  const nextPath = `/invite/accept?key=${encodeURIComponent(
    validation.data.rawKey,
  )}`;
  const { profile } = await requireUserProfile(nextPath);
  const rateLimit = await checkRequestRateLimit({
    bucket: "invitation.accept",
    identifiers: [profile.id, validation.data.rawKey],
    limit: 5,
    windowSeconds: 10 * 60,
  });

  if (!rateLimit.allowed) {
    return acceptErrorState(RATE_LIMITED_MESSAGE);
  }

  const result = await redeemAccessKey({
    rawKey: validation.data.rawKey,
    userId: profile.id,
    userEmail: profile.email,
    actorRole: profile.global_role,
    allowedTypes: ["JOIN_BRAND"],
    beforeRedeem: async ({ accessKey, now }) =>
      validateJoinBrandBeforeRedeem({ accessKey, now }),
  });

  if (!result.ok) {
    return acceptErrorState(result.message);
  }

  if (result.nextAction.kind !== "JOIN_BRAND_REQUIRED") {
    return acceptErrorState("This invitation cannot join a brand workspace.");
  }

  try {
    await acceptSpecialistInvitationForRedeemedAccessKey({
      accessKey: result.accessKey,
      userId: profile.id,
    });
  } catch (error) {
    try {
      await rollbackAccessKeyRedemption({
        redemption: result.redemption,
        actorUserId: profile.id,
        actorRole: profile.global_role,
      });
    } catch (rollbackError) {
      logServerError({
        label: "[invitations] redemption rollback failed",
        error: rollbackError,
        metadata: {
          profileId: profile.id,
          accessKeyId: result.accessKey.id,
        },
      });
    }
    logServerError({
      label: "[invitations] accept failed",
      error,
      metadata: {
        profileId: profile.id,
      },
    });

    return acceptErrorState("Invitation could not be accepted.");
  }

  revalidatePath("/");
  redirect("/");
}
