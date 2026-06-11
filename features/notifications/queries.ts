import "server-only";

import { notificationAudienceFilter } from "@/features/notifications/schema";
import type { NotificationRecord } from "@/features/notifications/types";
import { createAdminClient } from "@/lib/supabase/admin";

type NotificationRow = {
  id: string;
  brand_id: string | null;
  audience: string;
  type: string;
  title: string;
  body: string | null;
  link_path: string | null;
  subject_type: string | null;
  subject_id: string | null;
  comment_id: string | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string | null;
};

const NOTIFICATION_SELECT =
  "id, brand_id, audience, type, title, body, link_path, subject_type, subject_id, comment_id, actor_id, read_at, created_at";

function mapRow(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    audience: row.audience,
    type: row.type,
    title: row.title,
    body: row.body,
    linkPath: row.link_path,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    commentId: row.comment_id,
    actorId: row.actor_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function listNotificationsForProfile({
  profileId,
  globalRole,
  limit = 30,
}: {
  profileId: string;
  globalRole: string | null;
  limit?: number;
}): Promise<NotificationRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .or(notificationAudienceFilter(profileId, globalRole))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(mapRow);
}

export async function getUnreadNotificationCount({
  profileId,
  globalRole,
}: {
  profileId: string;
  globalRole: string | null;
}): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .or(notificationAudienceFilter(profileId, globalRole))
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}
