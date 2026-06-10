import "server-only";

import type {
  BrandEntitlementRecord,
  EntitlementSource,
  GrantBrandAccessInput,
  GrantBrandAccessResult,
} from "@/features/access/types";
import { entitlementSources } from "@/features/access/types";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

export type BrandAccessGrantRpcRow = {
  entitlement_id: string;
  entitlement_brand_id: string;
  entitlement_plan_id: string;
  entitlement_source: string;
  entitlement_status: string;
  entitlement_starts_at: string;
  entitlement_expires_at: string | null;
  entitlement_granted_by: string | null;
  entitlement_manual_reference: string | null;
  entitlement_internal_note: string | null;
  entitlement_created_at: string | null;
  included_agent_keys: string[] | null;
  matched_agent_keys: string[] | null;
  agent_entitlement_count: number;
};

function isEntitlementSource(value: string): value is EntitlementSource {
  return entitlementSources.includes(value as EntitlementSource);
}

function normalizeOptionalText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toIsoTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Plan grants require valid date values.");
  }

  return date.toISOString();
}

function toNullableIsoTimestamp(value: Date | string | null | undefined) {
  return value === null || value === undefined ? null : toIsoTimestamp(value);
}

function toBrandEntitlementRecord(
  row: BrandAccessGrantRpcRow,
): BrandEntitlementRecord {
  if (!isEntitlementSource(row.entitlement_source)) {
    throw new Error("Unsupported entitlement source.");
  }

  if (row.entitlement_status !== "ACTIVE") {
    throw new Error("Unexpected entitlement status.");
  }

  return {
    id: row.entitlement_id,
    brandId: row.entitlement_brand_id,
    planId: row.entitlement_plan_id,
    source: row.entitlement_source,
    status: row.entitlement_status,
    startsAt: row.entitlement_starts_at,
    expiresAt: row.entitlement_expires_at,
    grantedBy: row.entitlement_granted_by,
    manualReference: row.entitlement_manual_reference,
    internalNote: row.entitlement_internal_note,
    createdAt: row.entitlement_created_at,
  };
}

function toAuditGrant({
  entitlement,
  includedAgentKeys,
  matchedAgentKeys,
  unmatchedAgentKeys,
  agentEntitlementCount,
}: GrantBrandAccessResult) {
  return {
    entitlement_id: entitlement.id,
    brand_id: entitlement.brandId,
    plan_id: entitlement.planId,
    source: entitlement.source,
    status: entitlement.status,
    starts_at: entitlement.startsAt,
    expires_at: entitlement.expiresAt,
    manual_reference: entitlement.manualReference,
    internal_note: entitlement.internalNote,
    included_agent_keys: includedAgentKeys,
    matched_agent_keys: matchedAgentKeys,
    unmatched_agent_keys: unmatchedAgentKeys,
    agent_entitlement_count: agentEntitlementCount,
  };
}

export function toGrantBrandAccessResult(
  row: BrandAccessGrantRpcRow,
): GrantBrandAccessResult {
  const entitlement = toBrandEntitlementRecord(row);
  const includedAgentKeys = row.included_agent_keys ?? [];
  const matchedAgentKeys = row.matched_agent_keys ?? [];
  const matchedAgentKeySet = new Set(matchedAgentKeys);

  return {
    entitlement,
    includedAgentKeys,
    matchedAgentKeys,
    unmatchedAgentKeys: includedAgentKeys.filter(
      (key) => !matchedAgentKeySet.has(key),
    ),
    agentEntitlementCount: row.agent_entitlement_count,
  };
}

export async function auditBrandAccessGrant({
  result,
  actorUserId,
  actorRole,
}: {
  result: GrantBrandAccessResult;
  actorUserId: string;
  actorRole?: string | null;
}) {
  await logAudit({
    actorUserId,
    actorRole: actorRole ?? null,
    brandId: result.entitlement.brandId,
    action: "plan_granted",
    entityType: "brand_entitlement",
    entityId: result.entitlement.id,
    before: null,
    after: toAuditGrant(result),
  });
}

export async function grantBrandAccess(
  input: GrantBrandAccessInput,
): Promise<GrantBrandAccessResult> {
  if (!isEntitlementSource(input.source)) {
    throw new Error("Unsupported entitlement source.");
  }

  const startsAt = toIsoTimestamp(input.startsAt);
  const expiresAt = toNullableIsoTimestamp(input.expiresAt);

  if (expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
    throw new Error("Plan grant expiry must be after the start date.");
  }

  const admin = createAdminClient();
  const idempotencyKey = normalizeOptionalText(input.idempotencyKey);
  const { data, error } = await admin.rpc("grant_brand_access_atomic", {
    p_brand_id: input.brandId,
    p_plan_id: input.planId,
    p_source: input.source,
    p_starts_at: startsAt,
    p_expires_at: expiresAt,
    p_granted_by: input.grantedByUserId,
    p_manual_reference: normalizeOptionalText(input.manualReference),
    p_internal_note: normalizeOptionalText(input.internalNote),
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | BrandAccessGrantRpcRow
    | null;
  if (!row) {
    throw new Error("Plan grant transaction returned no entitlement.");
  }

  const result = toGrantBrandAccessResult(row);

  await auditBrandAccessGrant({
    result,
    actorUserId: input.grantedByUserId,
    actorRole: input.actorRole,
  });

  return result;
}
