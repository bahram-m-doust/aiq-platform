import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Most notifications are created transactionally alongside their source event
// (e.g. add_review_comment). This standalone helper covers events without a
// dedicated RPC, such as review decisions.
export async function createNotification({
  brandId,
  audience,
  recipientId = null,
  type,
  title,
  body = null,
  linkPath = null,
  subjectType = null,
  subjectId = null,
  actorId = null,
}: {
  brandId: string | null;
  audience: "ADMIN" | "INTERNAL_TEAM" | "CLIENT";
  recipientId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  linkPath?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  actorId?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    brand_id: brandId,
    audience,
    recipient_id: recipientId,
    type,
    title,
    body,
    link_path: linkPath,
    subject_type: subjectType,
    subject_id: subjectId,
    actor_id: actorId,
  });
  if (error) throw error;
}

// The audience filter is mandatory: without it any authenticated user could
// mark any notification read by iterating ids (IDOR). The same filter that
// scopes the inbox queries scopes the write.
export async function markNotificationRead({
  notificationId,
  audienceFilter,
}: {
  notificationId: string;
  audienceFilter: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null)
    .or(audienceFilter);
  if (error) throw error;
}

// Marks every notification visible to this profile as read. The OR filter must
// match listNotificationsForProfile so "mark all read" clears the same inbox.
export async function markAllNotificationsRead({
  audienceFilter,
}: {
  audienceFilter: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .or(audienceFilter)
    .is("read_at", null);
  if (error) throw error;
}
