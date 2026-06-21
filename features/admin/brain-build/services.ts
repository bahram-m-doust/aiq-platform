import "server-only";

import { getBrandBrainAgent } from "@/features/agents/brain/queries";
import type { UserProfile } from "@/features/auth/types";
import {
  isRagSyncServiceError,
  syncBrandKnowledgeBase,
} from "@/features/rag/sync";
import { logAudit } from "@/lib/audit/logAudit";
import { sendEmailWithResend } from "@/lib/email/sendEmail";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { logServerError } from "@/lib/logging/server";
import { ROUTES } from "@/lib/routes";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE = "brain_build";

export function isBrainBuildServiceError(
  error: unknown,
): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

function brainBuildError(message: string): never {
  throw new DomainError(CODE, message);
}

type BrandRow = { id: string; name: string };

async function getBrand(brandId: string): Promise<BrandRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw error;
  return data as BrandRow | null;
}

// Upsert the single per-brand schedule row, optionally stamping completion.
async function upsertSchedule({
  brandId,
  targetDate,
  actorId,
  built,
}: {
  brandId: string;
  targetDate?: string;
  actorId: string;
  built?: boolean;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const update: Record<string, string | null> = { updated_at: now };
  if (targetDate) {
    update.target_date = targetDate;
    update.scheduled_by = actorId;
  }
  if (built) {
    update.built_at = now;
    update.built_by = actorId;
  }

  // Try update first; fall back to insert when no row exists yet.
  const { data: existing, error: selectError } = await admin
    .from("brain_build_schedule")
    .select("brand_id, target_date")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await admin
      .from("brain_build_schedule")
      .update(update)
      .eq("brand_id", brandId);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("brain_build_schedule").insert({
    brand_id: brandId,
    // A build run without a prior schedule still needs a target_date (NOT NULL);
    // default it to today so the row is valid.
    target_date: targetDate ?? now.slice(0, 10),
    scheduled_by: actorId,
    built_at: built ? now : null,
    built_by: built ? actorId : null,
  });
  if (error) throw error;
}

export async function scheduleBrainBuild({
  brandId,
  targetDate,
  actor,
}: {
  brandId: string;
  targetDate: string;
  actor: UserProfile;
}): Promise<{ brandName: string }> {
  const brand = await getBrand(brandId);
  if (!brand) {
    brainBuildError("Brand could not be found.");
  }

  await upsertSchedule({ brandId, targetDate, actorId: actor.id });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId,
    action: "brain_build_scheduled",
    entityType: "brain_build_schedule",
    entityId: brandId,
    before: null,
    after: { target_date: targetDate },
  });

  return { brandName: brand.name };
}

// Activate the Brand Brain agent entitlement so Phase 04's "Agent Deployment"
// substep reads as done. Idempotent via the (brand_id, agent_id) unique key.
async function activateBrandBrainAgent(brandId: string) {
  const agent = await getBrandBrainAgent();
  if (!agent) {
    return; // Agent catalog not seeded — sync still unlocks the chatbot.
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: existing, error: selectError } = await admin
    .from("agent_entitlements")
    .select("id, status")
    .eq("brand_id", brandId)
    .eq("agent_id", agent.id)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const row = existing as { id: string; status: string };
    if (row.status !== "ACTIVE") {
      const { error } = await admin
        .from("agent_entitlements")
        .update({ status: "ACTIVE", activated_at: now })
        .eq("id", row.id);
      if (error) throw error;
    }
    return;
  }

  const { error } = await admin.from("agent_entitlements").insert({
    brand_id: brandId,
    agent_id: agent.id,
    status: "ACTIVE",
    starts_at: now,
    activated_at: now,
  });
  if (error) throw error;
}

type MembershipRow = { user_id: string };
type ProfileRow = { id: string; email: string | null };

async function notifyBrandMembers({
  brandId,
  brandName,
  actorId,
}: {
  brandId: string;
  brandName: string;
  actorId: string;
}): Promise<number> {
  const admin = createAdminClient();

  // Two queries (membership then profiles) instead of an embed — mirrors the
  // admin brands query and avoids Supabase's to-one/array embed ambiguity.
  const { data: membershipData, error: membershipError } = await admin
    .from("brand_memberships")
    .select("user_id")
    .eq("brand_id", brandId)
    .eq("status", "ACTIVE");
  if (membershipError) throw membershipError;

  const userIds = Array.from(
    new Set(((membershipData ?? []) as MembershipRow[]).map((m) => m.user_id)),
  );
  if (userIds.length === 0) {
    return 0;
  }

  const link = ROUTES.brainBrand;
  const title = "Your Brand Brain is ready";
  const body =
    "Your Integrated Brand Brain is now live. Open it to start a conversation grounded in your brand knowledge.";

  // In-app notifications, one per member.
  const notificationRows = userIds.map((userId) => ({
    brand_id: brandId,
    audience: "CLIENT",
    recipient_id: userId,
    type: "BRAIN_BUILD_COMPLETE",
    title,
    body,
    link_path: link,
    actor_id: actorId,
  }));
  const { error: notifyError } = await admin
    .from("notifications")
    .insert(notificationRows);
  if (notifyError) {
    // Notifications are best-effort — a failure here must not undo the build.
    logServerError({
      label: "[brain-build] notification insert failed",
      error: notifyError,
      metadata: { brandId },
    });
  }

  const { data: profileData, error: profileError } = await admin
    .from("users_profile")
    .select("id, email")
    .in("id", userIds);
  if (profileError) {
    logServerError({
      label: "[brain-build] member email lookup failed",
      error: profileError,
      metadata: { brandId },
    });
    return userIds.length;
  }

  // Email each member with a real address. Delivery is best-effort; Resend
  // failures degrade silently, consistent with the rest of the platform.
  await Promise.all(
    ((profileData ?? []) as ProfileRow[])
      .map((profile) => profile.email)
      .filter((email): email is string => Boolean(email))
      .map((email) =>
        sendEmailWithResend({
          to: email,
          subject: `Your Brand Brain is ready — ${brandName}`,
          text: `${body}\n\nOpen Brand Brain: ${link}`,
          html: `<p>${body}</p><p><a href="${link}">Open Brand Brain</a></p>`,
        }).catch(() => undefined),
      ),
  );

  return userIds.length;
}

export async function buildBrainNow({
  brandId,
  actor,
}: {
  brandId: string;
  actor: UserProfile;
}): Promise<{
  brandName: string;
  builtAt: string;
  syncedCount: number;
  notifiedCount: number;
}> {
  const brand = await getBrand(brandId);
  if (!brand) {
    brainBuildError("Brand could not be found.");
  }

  // 1. Real RAG sync — chunk + embed every RAG_APPROVED file into pgvector and
  //    flip the knowledge base to RAG_SYNCED. This is what genuinely makes the
  //    chatbot answer from brand knowledge.
  let syncedCount = 0;
  try {
    const result = await syncBrandKnowledgeBase({
      brandId,
      triggeredBy: actor,
    });
    syncedCount = result.syncedCount;
  } catch (error) {
    if (isRagSyncServiceError(error)) {
      brainBuildError(
        `Brain could not be built: ${error.message} Approve at least one document into RAG first.`,
      );
    }
    throw error;
  }

  if (syncedCount === 0) {
    brainBuildError(
      "Brain could not be built: no documents synced. Approve documents into RAG, then try again.",
    );
  }

  // 2. Activate the Brand Brain agent for the roadmap's Agent Deployment step.
  await activateBrandBrainAgent(brandId);

  // 3. Stamp completion — this is the signal the brand-facing roadmap reads to
  //    unlock the chatbot.
  await upsertSchedule({ brandId, actorId: actor.id, built: true });

  // 4. Notify + email the brand team.
  const notifiedCount = await notifyBrandMembers({
    brandId,
    brandName: brand.name,
    actorId: actor.id,
  });

  const builtAt = new Date().toISOString();

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId,
    action: "brain_build_completed",
    entityType: "brain_build_schedule",
    entityId: brandId,
    before: null,
    after: { synced_count: syncedCount, notified_count: notifiedCount },
  });

  return {
    brandName: brand.name,
    builtAt,
    syncedCount,
    notifiedCount,
  };
}
