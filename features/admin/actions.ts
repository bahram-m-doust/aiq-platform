"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import {
  buildAdminAccessKeySuccessState,
  validateAdminAccessKeyFormData,
} from "@/features/admin/access-key-schema";
import { verifyAdminAccessKeyReferences } from "@/features/admin/queries";
import type { AdminAccessKeyFormState } from "@/features/admin/types";
import { getTrustedRequestOrigin } from "@/features/auth/origins";
import { requirePlatformOwner } from "@/features/auth/queries";
import {
  createAccessKey,
  updateAccessKeyEmailDelivery,
} from "@/features/access/services";
import { markDemoRequestApproved } from "@/features/demo-requests/services";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { sendEmailWithResend, getResendEmailConfig } from "@/lib/email/sendEmail";
import {
  buildAccessKeyEmail,
  buildAccessKeyRedeemUrl,
} from "@/lib/email/templates";
import { logServerError } from "@/lib/logging/server";

function errorState(message: string): AdminAccessKeyFormState {
  return { status: "error", message };
}

export async function createAdminAccessKeyAction(
  _previousState: AdminAccessKeyFormState,
  formData: FormData,
): Promise<AdminAccessKeyFormState> {
  const { profile } = await requirePlatformOwner("/admin/access-keys");
  const validation = validateAdminAccessKeyFormData(formData);

  if (validation.error || !validation.data) {
    return errorState(validation.error ?? "Invalid access key details.");
  }

  if (validation.data.sendEmail) {
    const emailConfig = getResendEmailConfig();

    if (!emailConfig.ok) {
      return errorState(emailConfig.message);
    }
  }

  const references = await verifyAdminAccessKeyReferences({
    planId: validation.data.planId,
    targetBrandId: validation.data.targetBrandId,
  });

  if (!references.planExists) {
    return errorState("Choose an active plan.");
  }

  if (!references.brandExists) {
    return errorState("Choose an existing target brand.");
  }

  try {
    const created = await createAccessKey({
      type: validation.data.type,
      targetEmail: validation.data.targetEmail,
      targetBrandId: validation.data.targetBrandId,
      targetRole: validation.data.targetRole,
      planId: validation.data.planId,
      expiresAt: validation.data.expiresAt,
      createdByUserId: profile.id,
      actorRole: profile.global_role,
    });
    const rawKey = created.rawKey;
    let accessKey = created.accessKey;
    let resendEmailId: string | null = null;
    let warning: string | undefined;

    if (validation.data.sendEmail) {
      const redeemUrl = buildAccessKeyRedeemUrl({
        origin: await getTrustedRequestOrigin(),
        rawKey,
        type: validation.data.type,
      });
      const email = buildAccessKeyEmail({
        rawKey,
        redeemUrl,
        type: validation.data.type,
        expiresAt: validation.data.expiresAt,
      });
      const emailResult = await sendEmailWithResend({
        to: validation.data.targetEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });

      if (emailResult.ok) {
        resendEmailId = emailResult.id;

        if (resendEmailId) {
          try {
            accessKey = await updateAccessKeyEmailDelivery({
              accessKeyId: accessKey.id,
              resendEmailId,
            });
          } catch {
            warning = "Email was sent, but its Resend id could not be stored.";
          }
        } else {
          warning = "Email was sent, but Resend did not return an email id.";
        }
      } else {
        warning = emailResult.message;
      }
    }

    const demoRequestIdRaw = formData.get("demo_request_id");
    const demoRequestId =
      typeof demoRequestIdRaw === "string" && demoRequestIdRaw.trim().length > 0
        ? demoRequestIdRaw.trim()
        : null;

    if (demoRequestId) {
      try {
        await markDemoRequestApproved({
          demoRequestId,
          reviewer: profile,
          accessKeyId: accessKey.id,
        });
        revalidateTag(CACHE_TAGS.demoRequests, "max");
        revalidatePath("/admin/demo-requests");
        revalidatePath("/admin");
      } catch (error) {
        logServerError({
          label: "[admin] demo request approval link failed",
          error,
          metadata: { demoRequestId, accessKeyId: accessKey.id },
        });
        warning = warning
          ? `${warning} Demo request row could not be updated.`
          : "Access key was created but the demo request row could not be updated.";
      }
    }

    revalidatePath("/admin/access-keys");

    return buildAdminAccessKeySuccessState({
      rawKey,
      accessKey,
      resendEmailId,
      ...(warning ? { warning } : {}),
    });
  } catch {
    return errorState("Access key could not be created.");
  }
}
