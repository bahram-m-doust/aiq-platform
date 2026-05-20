import "server-only";

import type { AuditLogRecord } from "@/features/audit/types";
import { createAdminClient } from "@/lib/supabase/admin";

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  brand_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before_json: unknown;
  after_json: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
};

const auditLogColumns = [
  "id",
  "actor_user_id",
  "actor_role",
  "brand_id",
  "action",
  "entity_type",
  "entity_id",
  "before_json",
  "after_json",
  "ip_address",
  "user_agent",
  "created_at",
].join(", ");

function clampLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 100;
  }

  return Math.min(100, Math.max(1, Math.floor(limit)));
}

function toAuditLogRecord(row: AuditLogRow): AuditLogRecord {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    brandId: row.brand_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: row.before_json,
    after: row.after_json,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

export async function getLatestAuditLogs(limit = 100) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_logs")
    .select(auditLogColumns)
    .order("created_at", { ascending: false })
    .limit(clampLimit(limit));

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as AuditLogRow[]).map(toAuditLogRecord);
}
