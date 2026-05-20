import "server-only";

import {
  buildAgentEntitlementUpserts,
  findUnmatchedAgentKeys,
  parseIncludedAgentKeys,
  type AgentLookupRecord,
} from "@/features/access/grant-brand-access-rules";
import type {
  BrandEntitlementRecord,
  EntitlementSource,
  GrantBrandAccessInput,
  GrantBrandAccessResult,
} from "@/features/access/types";
import { entitlementSources } from "@/features/access/types";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

type BrandRow = {
  id: string;
};

type PlanRow = {
  id: string;
  included_agents: unknown;
};

type BrandEntitlementRow = {
  id: string;
  brand_id: string;
  plan_id: string;
  source: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  granted_by: string | null;
  manual_reference: string | null;
  internal_note: string | null;
  created_at: string | null;
};

const entitlementColumns = [
  "id",
  "brand_id",
  "plan_id",
  "source",
  "status",
  "starts_at",
  "expires_at",
  "granted_by",
  "manual_reference",
  "internal_note",
  "created_at",
].join(", ");

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
  row: BrandEntitlementRow,
): BrandEntitlementRecord {
  if (!isEntitlementSource(row.source)) {
    throw new Error("Unsupported entitlement source.");
  }

  if (row.status !== "ACTIVE") {
    throw new Error("Unexpected entitlement status.");
  }

  return {
    id: row.id,
    brandId: row.brand_id,
    planId: row.plan_id,
    source: row.source,
    status: row.status,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    grantedBy: row.granted_by,
    manualReference: row.manual_reference,
    internalNote: row.internal_note,
    createdAt: row.created_at,
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
  const [brandResult, planResult] = await Promise.all([
    admin.from("brands").select("id").eq("id", input.brandId).maybeSingle(),
    admin
      .from("plans")
      .select("id, included_agents")
      .eq("id", input.planId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (brandResult.error) {
    throw brandResult.error;
  }

  if (planResult.error) {
    throw planResult.error;
  }

  if (!(brandResult.data as BrandRow | null)) {
    throw new Error("Brand could not be found.");
  }

  const plan = planResult.data as PlanRow | null;

  if (!plan) {
    throw new Error("Active plan could not be found.");
  }

  const { data: entitlementData, error: entitlementError } = await admin
    .from("brand_entitlements")
    .insert({
      brand_id: input.brandId,
      plan_id: input.planId,
      source: input.source,
      status: "ACTIVE",
      starts_at: startsAt,
      expires_at: expiresAt,
      granted_by: input.grantedByUserId,
      manual_reference: normalizeOptionalText(input.manualReference),
      internal_note: normalizeOptionalText(input.internalNote),
    })
    .select(entitlementColumns)
    .single();

  if (entitlementError) {
    throw entitlementError;
  }

  const entitlement = toBrandEntitlementRecord(
    entitlementData as unknown as BrandEntitlementRow,
  );
  const includedAgentKeys = parseIncludedAgentKeys(plan.included_agents);
  let matchedAgents: AgentLookupRecord[] = [];

  if (includedAgentKeys.length > 0) {
    const { data: agentData, error: agentError } = await admin
      .from("agents")
      .select("id, key")
      .in("key", includedAgentKeys)
      .eq("is_active", true);

    if (agentError) {
      throw agentError;
    }

    matchedAgents = (agentData ?? []) as AgentLookupRecord[];
  }

  const agentRows = buildAgentEntitlementUpserts({
    brandId: input.brandId,
    planId: input.planId,
    startsAt,
    expiresAt,
    agents: matchedAgents,
  });

  if (agentRows.length > 0) {
    const { error: agentEntitlementError } = await admin
      .from("agent_entitlements")
      .upsert(agentRows, {
        onConflict: "brand_id,agent_id",
      });

    if (agentEntitlementError) {
      throw agentEntitlementError;
    }
  }

  const result: GrantBrandAccessResult = {
    entitlement,
    includedAgentKeys,
    matchedAgentKeys: matchedAgents.map((agent) => agent.key),
    unmatchedAgentKeys: findUnmatchedAgentKeys({
      includedAgentKeys,
      agents: matchedAgents,
    }),
    agentEntitlementCount: agentRows.length,
  };

  await logAudit({
    actorUserId: input.grantedByUserId,
    actorRole: input.actorRole ?? null,
    brandId: input.brandId,
    action: "plan_granted",
    entityType: "brand_entitlement",
    entityId: entitlement.id,
    before: null,
    after: toAuditGrant(result),
  });

  return result;
}
