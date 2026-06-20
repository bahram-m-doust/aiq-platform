import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSensitiveKey,
  sanitize,
  type SafeJson,
} from "@/lib/security/sanitize";
import { logServerError } from "@/lib/logging/server";

export const auditActions = [
  "access_key_created",
  "access_key_revoked",
  "access_key_redeemed",
  "access_key_redemption_rolled_back",
  "access_key_failed",
  "brand_created",
  "brand_claimed",
  "brand_deleted",
  "brand_member_removed",
  "brand_member_role_changed",
  "plan_granted",
  "plan_suspended",
  "member_invited",
  "member_joined",
  "intake_answer_updated",
  "intake_final_submitted",
  "intake_reopened",
  "intake_section_created",
  "intake_section_updated",
  "intake_section_archived",
  "intake_section_unarchived",
  "intake_question_created",
  "intake_question_updated",
  "intake_question_archived",
  "intake_question_unarchived",
  "intake_question_reordered",
  "intake_question_deleted",
  "intake_section_deleted",
  "change_request_created",
  "change_request_status_updated",
  "demo_request_created",
  "demo_request_approved",
  "demo_request_rejected",
  "file_uploaded",
  "file_downloaded",
  "specialist_file_approved",
  "admin_file_uploaded",
  "admin_file_archived",
  "admin_file_unarchived",
  "admin_file_deleted",
  "module_uploaded",
  "module_sent_to_client",
  "module_client_approved",
  "module_change_requested",
  "rag_approved",
  "rag_sync_started",
  "rag_sync_completed",
  "agent_activated",
  "agent_run_created",
  "admin_override_used",
  "intake_knowledge_generated",
  "admin_file_rag_promoted",
  "brand_instruction_updated",
] as const;

export type AuditAction = (typeof auditActions)[number];

export type AuditJson = SafeJson;

export type LogAuditInput = {
  actorUserId?: string | null;
  actorRole?: string | null;
  brandId?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function isSensitiveAuditKey(key: string) {
  return isSensitiveKey(key);
}

export function sanitizeAuditJson(value: unknown): AuditJson {
  return sanitize(value, { maxDepth: 20 });
}

export async function logAudit(input: LogAuditInput): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      actor_user_id: input.actorUserId ?? null,
      actor_role: input.actorRole ?? null,
      brand_id: input.brandId ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      before_json: sanitizeAuditJson(input.before ?? null),
      after_json: sanitizeAuditJson(input.after ?? null),
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    // Audit persistence must be observable, but it must not turn an already
    // committed business mutation into a retry that duplicates side effects.
    logServerError({
      label: "[audit] persistence failed",
      error,
      metadata: {
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        brandId: input.brandId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    });
    return false;
  }
}
