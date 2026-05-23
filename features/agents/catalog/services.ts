import "server-only";

import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";
import {
  canActivateAgentRole,
  toAgentActivatedAuditMetadata,
} from "@/features/agents/catalog/schema";
import type { CatalogAgentKey } from "@/features/agents/catalog/types";
import type { UserProfile } from "@/features/auth/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE = "agent_activation";

export function isAgentActivationServiceError(
  error: unknown,
): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

function activationError(message: string): never {
  throw new DomainError(CODE, message);
}

async function updateEntitlementToActive({
  entitlementId,
  brandId,
  agentId,
}: {
  entitlementId: string;
  brandId: string;
  agentId: string;
}) {
  const admin = createAdminClient();
  const activatedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("agent_entitlements")
    .update({
      status: "ACTIVE",
      activated_at: activatedAt,
    })
    .eq("id", entitlementId)
    .eq("brand_id", brandId)
    .eq("agent_id", agentId)
    .in("status", ["LOCKED_BY_BRAIN", "AVAILABLE"])
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    activationError("This agent is no longer available for activation.");
  }

  return activatedAt;
}

async function insertActivationAudit({
  profile,
  brandId,
  entitlementId,
  agentId,
  agentKey,
  oldStatus,
}: {
  profile: UserProfile;
  brandId: string;
  entitlementId: string;
  agentId: string;
  agentKey: CatalogAgentKey;
  oldStatus: string;
}) {
  const metadata = toAgentActivatedAuditMetadata({
    brandId,
    agentId,
    agentKey,
    oldStatus,
    actorId: profile.id,
  });
  await logAudit({
    actorUserId: profile.id,
    actorRole: profile.global_role,
    brandId,
    action: "agent_activated",
    entityType: "agent_entitlement",
    entityId: entitlementId,
    before: {
      ...metadata,
      new_status: oldStatus,
    },
    after: metadata,
  });
}

export async function activateCatalogAgent({
  profile,
  agentKey,
}: {
  profile: UserProfile;
  agentKey: CatalogAgentKey;
}) {
  const workspace = await getAgentCatalogWorkspace(profile.id);

  if (!workspace) {
    activationError("Active brand access is required to activate agents.");
  }

  if (!canActivateAgentRole(workspace.access.membershipRole)) {
    activationError("Only Owners and Executive Managers can activate agents.");
  }

  const agent = workspace.agents.find((item) => item.key === agentKey) ?? null;

  if (!agent || !agent.agentId) {
    activationError("This agent is not configured for activation.");
  }

  if (!agent.entitlementId || !agent.entitlementStatus) {
    activationError("This agent is not included in the current plan.");
  }

  if (!workspace.brainReady) {
    activationError(workspace.brainReadinessMessage);
  }

  if (agent.displayState === "ACTIVE") {
    return {
      agentKey: agent.key,
      message: "This agent is already active.",
    };
  }

  if (!agent.isActivatable) {
    activationError(agent.stateMessage);
  }

  await updateEntitlementToActive({
    entitlementId: agent.entitlementId,
    brandId: workspace.access.brandId,
    agentId: agent.agentId,
  });
  await insertActivationAudit({
    profile,
    brandId: workspace.access.brandId,
    entitlementId: agent.entitlementId,
    agentId: agent.agentId,
    agentKey: agent.key,
    oldStatus: agent.entitlementStatus,
  });

  return {
    agentKey: agent.key,
    message: `${agent.name} is now active.`,
  };
}
