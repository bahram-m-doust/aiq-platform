import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const auditActions = [
  "access_key_created",
  "access_key_redeemed",
  "access_key_failed",
  "brand_created",
  "brand_claimed",
  "plan_granted",
  "plan_suspended",
  "member_invited",
  "member_joined",
  "intake_answer_updated",
  "intake_final_submitted",
  "intake_section_created",
  "intake_section_updated",
  "intake_section_archived",
  "intake_question_created",
  "intake_question_updated",
  "intake_question_archived",
  "intake_question_reordered",
  "change_request_created",
  "change_request_status_updated",
  "file_uploaded",
  "file_downloaded",
  "specialist_file_approved",
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
] as const;

export type AuditAction = (typeof auditActions)[number];

export type AuditJson =
  | null
  | string
  | number
  | boolean
  | AuditJson[]
  | { [key: string]: AuditJson };

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

const redactedValue = "[REDACTED]";
const sensitiveKeyNames = new Set([
  "apikey",
  "authorization",
  "content",
  "documentcontent",
  "filecontent",
  "hash",
  "keyhash",
  "outputtext",
  "prompt",
  "rawaccesskey",
  "rawkey",
  "secret",
  "servicerolekey",
  "signeddownloadurl",
  "signedurl",
  "token",
  "answer",
]);

function normalizedKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSensitiveAuditKey(key: string) {
  const normalized = normalizedKey(key);

  return (
    sensitiveKeyNames.has(normalized) ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token") ||
    normalized.endsWith("signedurl") ||
    normalized.endsWith("filecontent") ||
    normalized.endsWith("documentcontent")
  );
}

function sanitizeAuditValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): AuditJson {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (depth > 20) {
      return redactedValue;
    }

    return value.map((item) => sanitizeAuditValue(item, seen, depth + 1));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return redactedValue;
    }

    if (depth > 20) {
      return redactedValue;
    }

    seen.add(value);

    return Object.entries(value).reduce<Record<string, AuditJson>>(
      (safeJson, [key, entryValue]) => {
        if (entryValue === undefined) {
          return safeJson;
        }

        safeJson[key] = isSensitiveAuditKey(key)
          ? redactedValue
          : sanitizeAuditValue(entryValue, seen, depth + 1);
        return safeJson;
      },
      {},
    );
  }

  return String(value);
}

export function sanitizeAuditJson(value: unknown): AuditJson {
  return sanitizeAuditValue(value, new WeakSet(), 0);
}

export async function logAudit(input: LogAuditInput) {
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

  if (error) {
    throw error;
  }
}
