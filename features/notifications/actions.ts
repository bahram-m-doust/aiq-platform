"use server";

import { revalidatePath } from "next/cache";

import { requireUserProfile } from "@/features/auth/queries";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/mutation-service";
import { notificationAudienceFilter } from "@/features/notifications/schema";
import type { NotificationMutationResult } from "@/features/notifications/types";
import { logServerError } from "@/lib/logging/server";

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationMutationResult> {
  const { profile } = await requireUserProfile("/home");
  try {
    await markNotificationRead({ notificationId });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (caught) {
    logServerError({
      label: "[notifications] mark read failed",
      error: caught,
      metadata: { notificationId, profileId: profile.id },
    });
    return { ok: false, message: "Could not update the notification." };
  }
}

export async function markAllNotificationsReadAction(): Promise<NotificationMutationResult> {
  const { profile } = await requireUserProfile("/home");
  try {
    await markAllNotificationsRead({
      audienceFilter: notificationAudienceFilter(
        profile.id,
        profile.global_role,
      ),
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (caught) {
    logServerError({
      label: "[notifications] mark all read failed",
      error: caught,
      metadata: { profileId: profile.id },
    });
    return { ok: false, message: "Could not update notifications." };
  }
}
