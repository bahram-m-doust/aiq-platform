import "server-only";

import type { UserProfile } from "@/features/auth/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE = "brand_instruction_service";

export function isBrandInstructionServiceError(
  error: unknown,
): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

export async function upsertBrandAgentInstruction({
  profile,
  brandId,
  agentId,
  instruction,
  isEnabled,
}: {
  profile: UserProfile;
  brandId: string;
  agentId: string | null;
  instruction: string;
  isEnabled: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc(
    "upsert_brand_agent_instruction_atomic",
    {
      p_brand_id: brandId,
      p_agent_id: agentId,
      p_instruction: instruction,
      p_is_enabled: isEnabled,
      p_updated_by: profile.id,
    },
  );

  if (error) {
    throw new DomainError(CODE, error.message);
  }

  // Keep instruction content out of the audit trail.
  await logAudit({
    actorUserId: profile.id,
    actorRole: profile.global_role,
    brandId,
    action: "brand_instruction_updated",
    entityType: "brand_agent_settings",
    entityId: agentId,
    before: null,
    after: {
      brand_id: brandId,
      agent_id: agentId,
      is_enabled: isEnabled,
      instruction_length: instruction.length,
    },
  });
}
