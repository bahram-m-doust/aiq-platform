import "server-only";

import type { AuditLogPage, AuditLogRecord } from "@/features/audit/types";
import {
  type PaginationInput,
  paginatedRows,
  toSupabaseRange,
} from "@/lib/pagination";
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

function paginationInputFromLimit(
  input: PaginationInput | number | undefined,
): PaginationInput {
  return typeof input === "number" ? { pageSize: input } : (input ?? {});
}

export async function getLatestAuditLogs(
  input?: PaginationInput | number,
): Promise<AuditLogPage> {
  const admin = createAdminClient();
  const range = toSupabaseRange(paginationInputFromLimit(input));
  const { data, error } = await admin
    .from("audit_logs")
    .select(auditLogColumns)
    .order("created_at", { ascending: false })
    .range(range.from, range.to + 1);

  if (error) {
    throw error;
  }

  const paginated = paginatedRows(
    (data ?? []) as unknown as AuditLogRow[],
    range,
  );

  return {
    logs: paginated.rows.map(toAuditLogRecord),
    pagination: paginated.pagination,
  };
}
