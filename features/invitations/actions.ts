"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { redeemAccessKey } from "@/features/access/services";
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

function invitationErrorState(message: string): SpecialistInvitationFormState {
  return { status: "error", message };
}

function acceptErrorState(message: string): AcceptInvitationFormState {
  return { status: "error", message };
}

async function getAppOrigin() {
  const headerStore = await headers();
  return (
    headerStore.get("origin") ??
    process.env.APP_BASE_URL ??
    "http://localhost:3000"
  );
}

export async function createSpecialistInvitationAction(
  _previousState: SpecialistInvitationFormState,
  formData: FormData,
): Promise<SpecialistInvitationFormState> {
  const { user, profile } = await requireUserProfile("/dashboard/invitations");
  const validation = validateSpecialistInvitationFormData(formData);

  if (validation.error || !validation.data) {
    return invitationErrorState(
      validation.error ?? "Invitation details are invalid.",
    );
  }

  try {
    const result = await createSpecialistInvitation({
      input: validation.data,
      inviterProfileId: profile.id,
      inviterEmail: user.email ?? profile.email,
      appOrigin: await getAppOrigin(),
    });

    revalidatePath("/dashboard/invitations");

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
  } catch {
    return acceptErrorState("Invitation could not be accepted.");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
