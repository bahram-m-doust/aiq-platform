"use server";

import { revalidatePath } from "next/cache";

import {
  buildAdminAccessKeySuccessState,
  validateAdminAccessKeyFormData,
} from "@/features/admin/access-key-schema";
import { verifyAdminAccessKeyReferences } from "@/features/admin/queries";
import type { AdminAccessKeyFormState } from "@/features/admin/types";
import { requirePlatformOwner } from "@/features/auth/queries";
import {
  createAccessKey,
  updateAccessKeyEmailDelivery,
} from "@/features/access/services";
import { sendEmailWithResend, getResendEmailConfig } from "@/lib/email/sendEmail";
import { buildAccessKeyEmail } from "@/lib/email/templates";

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
      const email = buildAccessKeyEmail({
        rawKey,
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
