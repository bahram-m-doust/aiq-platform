"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import { redeemAccessKey } from "@/features/access/services";
import type {
  AccessKeyRedemptionFormState,
  RedeemAccessKeyResult,
} from "@/features/access/types";
import {
  claimBrandForRedeemedAccessKey,
  validateClaimBrandBeforeRedeem,
} from "@/features/brands/claim-brand/services";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";
import { logServerError } from "@/lib/logging/server";

function readAccessKey(formData: FormData) {
  const value =
    formData.get("accessKey") ??
    formData.get("access_key") ??
    formData.get("key");

  return typeof value === "string" ? value : "";
}

export async function redeemAccessKeyAction(
  formData: FormData,
): Promise<RedeemAccessKeyResult> {
  const { profile } = await requireUserProfile("/dashboard");
  const rawKey = readAccessKey(formData);
  const rateLimit = await checkRequestRateLimit({
    bucket: "access.redeem",
    identifiers: [profile.id, rawKey],
    limit: 5,
    windowSeconds: 10 * 60,
  });

  if (!rateLimit.allowed) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: RATE_LIMITED_MESSAGE,
    };
  }

  return redeemAccessKey({
    rawKey,
    userId: profile.id,
    userEmail: profile.email,
    actorRole: profile.global_role,
  });
}

export async function redeemDashboardAccessKeyAction(
  _previousState: AccessKeyRedemptionFormState,
  formData: FormData,
): Promise<AccessKeyRedemptionFormState> {
  const { profile } = await requireUserProfile("/dashboard");
  const rawKey = readAccessKey(formData);
  const rateLimit = await checkRequestRateLimit({
    bucket: "access.redeem",
    identifiers: [profile.id, rawKey],
    limit: 5,
    windowSeconds: 10 * 60,
  });

  if (!rateLimit.allowed) {
    return {
      status: "error",
      message: RATE_LIMITED_MESSAGE,
    };
  }

  const result = await redeemAccessKey({
    rawKey,
    userId: profile.id,
    userEmail: profile.email,
    actorRole: profile.global_role,
    allowedTypes: ["CREATE_BRAND", "CLAIM_BRAND"],
    beforeRedeem: async ({ accessKey, userId, userEmail, now }) => {
      if (accessKey.type !== "CLAIM_BRAND") {
        return null;
      }

      return validateClaimBrandBeforeRedeem({
        accessKey,
        userId,
        userEmail,
        now,
      });
    },
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  if (result.nextAction.kind === "CREATE_BRAND_REQUIRED") {
    redirect(
      `/dashboard/create-brand?access_key_id=${encodeURIComponent(
        result.nextAction.accessKeyId,
      )}`,
    );
  } else if (result.nextAction.kind === "CLAIM_BRAND_REQUIRED") {
    try {
      await claimBrandForRedeemedAccessKey({
        accessKey: result.accessKey,
        userId: profile.id,
        actorRole: profile.global_role,
      });
    } catch (error) {
      logServerError({
        label: "[access] brand claim failed",
        error,
        metadata: {
          profileId: profile.id,
          accessKeyId: result.accessKey.id,
        },
      });

      return {
        status: "error",
        message: "Brand could not be claimed.",
      };
    }

    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  return {
    status: "error",
    message: "This access key cannot activate this dashboard.",
  };
}
