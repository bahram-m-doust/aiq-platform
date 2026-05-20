import "server-only";

import { logAudit } from "@/lib/audit/logAudit";

type ModuleAuditAction =
  | "module_uploaded"
  | "module_sent_to_client"
  | "module_client_approved"
  | "module_change_requested"
  | "file_downloaded";

export async function insertModuleAuditLog({
  actorUserId,
  actorRole,
  brandId,
  action,
  entityType,
  entityId,
  beforeJson = null,
  afterJson,
}: {
  actorUserId: string;
  actorRole: string | null;
  brandId: string;
  action: ModuleAuditAction;
  entityType: "module" | "file";
  entityId: string;
  beforeJson?: Record<string, unknown> | null;
  afterJson: Record<string, unknown>;
}) {
  await logAudit({
    actorUserId,
    actorRole,
    brandId,
    action,
    entityType,
    entityId,
    before: beforeJson,
    after: afterJson,
  });
}
