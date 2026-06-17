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

// Never show someone their own activity: notifications they caused (e.g. a
// comment they wrote) are excluded from their inbox and badge. Chained `.or()`
// calls are ANDed by PostgREST, so this composes with the audience filter.
function actorSelfExclusion(profileId: string): string {
  return `actor_id.is.null,actor_id.neq.${profileId}`;
}

export async function listNotificationsForProfile({
  profileId,
  globalRole,
  brandId,
  limit = 30,
  includeInternalTeamInbox = true,
}: {
  profileId: string;
  globalRole: string | null;
  brandId: string | null;
  limit?: number;
  includeInternalTeamInbox?: boolean;
}): Promise<NotificationRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .or(
      notificationAudienceFilter(profileId, globalRole, brandId, {
        includeInternalTeamInbox,
      }),
    )
    .or(actorSelfExclusion(profileId))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(mapRow);
}

export async function getUnreadNotificationCount({
  profileId,
  globalRole,
  brandId,
  includeInternalTeamInbox = true,
}: {
  profileId: string;
  globalRole: string | null;
  brandId: string | null;
  includeInternalTeamInbox?: boolean;
}): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .or(
      notificationAudienceFilter(profileId, globalRole, brandId, {
        includeInternalTeamInbox,
      }),
    )
    .or(actorSelfExclusion(profileId))
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}
