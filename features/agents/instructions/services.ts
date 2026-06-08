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

type ExistingRow = {
  id: string;
};

// Upsert one instruction slot. The brand-wide default (agentId null) and each
// per-agent override are matched manually because the uniqueness lives in a
// coalesce() expression index that a plain ON CONFLICT cannot target.
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

  let lookup = admin
    .from("brand_agent_settings")
    .select("id")
    .eq("brand_id", brandId);
  lookup = agentId
    ? lookup.eq("agent_id", agentId)
    : lookup.is("agent_id", null);

  const { data: existing, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) {
    throw new DomainError(CODE, lookupError.message);
  }

  const now = new Date().toISOString();

  if (existing) {
    const { error: updateError } = await admin
      .from("brand_agent_settings")
      .update({
        instruction,
        is_enabled: isEnabled,
        updated_by: profile.id,
        updated_at: now,
      })
      .eq("id", (existing as ExistingRow).id);
    if (updateError) {
      throw new DomainError(CODE, updateError.message);
    }
  } else {
    const { error: insertError } = await admin
      .from("brand_agent_settings")
      .insert({
        brand_id: brandId,
        agent_id: agentId,
        instruction,
        is_enabled: isEnabled,
        updated_by: profile.id,
        updated_at: now,
      });
    if (insertError) {
      throw new DomainError(CODE, insertError.message);
    }
  }

  // Audit the change without storing the instruction body — record only its
  // shape so the trail stays lean and content-free.
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
