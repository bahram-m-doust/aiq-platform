"use server";

import { revalidatePath } from "next/cache";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/mutation-service";
import { notificationAudienceFilter } from "@/features/notifications/schema";
import type { NotificationMutationResult } from "@/features/notifications/types";
import { logServerError } from "@/lib/logging/server";
import { isUuid } from "@/lib/utils";

// The same audience scope used to read the inbox also scopes the mark-read
// writes, so a user can only act on notifications they can see.
async function callerAudienceFilter(): Promise<{
  profileId: string;
  audienceFilter: string;
}> {
  const { profile } = await requireUserProfile("/home");
  const access = await getBrandAccessSummaryForProfile(profile.id);
  const brandId =
    access.status === "ACTIVE_ACCESS" ? (access.brandId ?? null) : null;
  return {
    profileId: profile.id,
    audienceFilter: notificationAudienceFilter(
      profile.id,
      profile.global_role,
      brandId,
    ),
  };
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationMutationResult> {
  const { profileId, audienceFilter } = await callerAudienceFilter();
  if (!isUuid(notificationId)) {
    return { ok: false, message: "Notification not found." };
  }
  try {
    await markNotificationRead({ notificationId, audienceFilter });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (caught) {
    logServerError({
      label: "[notifications] mark read failed",
      error: caught,
      metadata: { notificationId, profileId },
    });
    return { ok: false, message: "Could not update the notification." };
  }
}

export async function markAllNotificationsReadAction(): Promise<NotificationMutationResult> {
  const { profileId, audienceFilter } = await callerAudienceFilter();
  try {
    await markAllNotificationsRead({ audienceFilter });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (caught) {
    logServerError({
      label: "[notifications] mark all read failed",
      error: caught,
      metadata: { profileId },
    });
    return { ok: false, message: "Could not update notifications." };
  }
}
