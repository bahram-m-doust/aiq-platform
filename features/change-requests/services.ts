import "server-only";

import {
  getIntakeSectionsWithQuestions,
  getLatestIntakeSessionForBrand,
} from "@/features/questionnaire/queries";
import {
  canCreateChangeRequestRole,
  canReviewChangeRequestRole,
  toChangeRequestCreatedAudit,
  toChangeRequestStatusAfterAudit,
  toChangeRequestStatusBeforeAudit,
  validateChangeRequestTargetContext,
} from "@/features/change-requests/schema";
import {
  changeRequestColumns,
  getBrandModulesForChangeRequests,
  getChangeRequestById,
  getChangeRequestCreateOptions,
  toChangeRequestRecord,
  type ChangeRequestRow,
} from "@/features/change-requests/queries";
import type {
  ChangeRequestRecord,
  CreatedChangeRequestResult,
  CreateChangeRequestInput,
  ReviewChangeRequestInput,
} from "@/features/change-requests/types";
import { createNotification } from "@/features/notifications/mutation-service";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { logServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE = "change_request";

function changeRequestError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isChangeRequestError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

async function latestIntakeIsLocked(brandId: string) {
  const session = await getLatestIntakeSessionForBrand(brandId);
  return Boolean(session && (session.status === "LOCKED" || session.lockedAt));
}

// Approving an intake change request reopens the brand's locked questionnaire so
// the owner can make the requested edit (it re-locks on the next submit).
async function reopenIntakeForBrand(
  brandId: string,
  reviewerId: string,
  actorRole: string | null,
): Promise<void> {
  const session = await getLatestIntakeSessionForBrand(brandId);
  if (!session || (session.status !== "LOCKED" && !session.lockedAt)) {
    return;
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("intake_sessions")
    .update({
      status: "DRAFT",
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("brand_id", brandId);
  if (error) throw error;

  await logAudit({
    actorUserId: reviewerId,
    actorRole,
    brandId,
    action: "intake_reopened",
    entityType: "intake_session",
    entityId: session.id,
    before: null,
    after: { via: "change_request" },
  });
}

export async function createChangeRequest({
  input,
  profileId,
}: {
  input: CreateChangeRequestInput;
  profileId: string;
}): Promise<CreatedChangeRequestResult> {
  const options = await getChangeRequestCreateOptions(profileId);

  if (!options || !canCreateChangeRequestRole(options.membershipRole)) {
    changeRequestError("You do not have permission to create Change Requests.");
  }

  const targetError = validateChangeRequestTargetContext({
    input,
    context: {
      intakeLocked: options.intakeLocked,
      sections: options.sections,
      modules: options.modules,
    },
  });

  if (targetError) {
    changeRequestError(targetError);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("change_requests")
    .insert({
      brand_id: options.brandId,
      target_type: input.targetType,
      target_id: input.targetType === "MODULE" ? input.moduleId : null,
      section_key:
        input.targetType === "INTAKE_SECTION" ||
        input.targetType === "INTAKE_QUESTION"
          ? input.sectionKey
          : null,
      question_id:
        input.targetType === "INTAKE_QUESTION" ? input.questionId : null,
      requested_by: profileId,
      reason: input.reason,
      comment: input.comment,
      status: "REQUESTED",
    })
    .select(changeRequestColumns)
    .single();

  if (error) {
    throw error;
  }

  const request = toChangeRequestRecord(data as unknown as ChangeRequestRow);
  const auditAction =
    request.targetType === "MODULE"
      ? "module_change_requested"
      : "change_request_created";
  await logAudit({
    actorUserId: profileId,
    actorRole: options.membershipRole,
    brandId: options.brandId,
    action: auditAction,
    entityType: "change_request",
    entityId: request.id,
    before: null,
    after: toChangeRequestCreatedAudit({ request }),
  });

  // Notify the internal team that a change request is waiting for review.
  // No actorId on purpose: the review queue must not self-exclude the requester
  // (an internal reviewer who is also the requester should still see it; the
  // requester is recorded on the change_request row). Best-effort: a
  // notification failure must never fail the submission itself.
  try {
    await createNotification({
      brandId: options.brandId,
      audience: "INTERNAL_TEAM",
      type: auditAction,
      // Lead with the brand name so reviewers can tell at a glance which brand
      // the request belongs to straight from the notification bar.
      title: `New change request · ${options.brandName}`,
      body: request.comment,
      // Deep-link to the specific request inside the review queue (the list
      // tags each card with this anchor id).
      linkPath: `/admin/change-requests#cr-${request.id}`,
      subjectType: "CHANGE_REQUEST",
      subjectId: request.id,
    });
  } catch (notifyError) {
    logServerError({
      label: "[change-request] notify failed",
      error: notifyError,
      metadata: { requestId: request.id, brandId: options.brandId },
    });
  }

  return { request, auditAction };
}

export async function reviewChangeRequest({
  input,
  reviewerId,
  actorRole,
}: {
  input: ReviewChangeRequestInput;
  reviewerId: string;
  actorRole: string | null;
}): Promise<ChangeRequestRecord> {
  if (!canReviewChangeRequestRole(actorRole)) {
    changeRequestError("You do not have permission to review Change Requests.");
  }

  const previousRequest = await getChangeRequestById(input.requestId);

  if (!previousRequest) {
    changeRequestError("Change Request could not be found.");
  }

  // A resolved request can't be moved back into review: this prevents reviving
  // an APPROVED/REJECTED/APPLIED/CLOSED decision and stops a stale second review
  // from clobbering the recorded resolution. Forward moves (e.g. APPROVED →
  // APPLIED → CLOSED) stay allowed.
  const resolvedStatuses = new Set(["APPROVED", "REJECTED", "APPLIED", "CLOSED"]);
  const reopenStatuses = new Set(["REQUESTED", "UNDER_REVIEW"]);
  if (
    resolvedStatuses.has(previousRequest.status) &&
    reopenStatuses.has(input.status)
  ) {
    changeRequestError(
      "This Change Request has already been resolved and can't be moved back to review.",
    );
  }

  const nowIso = new Date().toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("change_requests")
    .update({
      status: input.status,
      reviewed_by: reviewerId,
      resolution_note: input.resolutionNote,
      updated_at: nowIso,
    })
    .eq("id", previousRequest.id)
    .eq("brand_id", previousRequest.brandId)
    .select(changeRequestColumns)
    .single();

  if (error) {
    throw error;
  }

  const request = toChangeRequestRecord(data as unknown as ChangeRequestRow);
  await logAudit({
    actorUserId: reviewerId,
    actorRole,
    brandId: request.brandId,
    action: "change_request_status_updated",
    entityType: "change_request",
    entityId: request.id,
    before: toChangeRequestStatusBeforeAudit(previousRequest),
    after: toChangeRequestStatusAfterAudit({
      request,
      previousStatus: previousRequest.status,
    }),
  });

  // Approving an intake change request unlocks the questionnaire for editing.
  if (
    request.status === "APPROVED" &&
    (request.targetType === "INTAKE_SECTION" ||
      request.targetType === "INTAKE_QUESTION")
  ) {
    await reopenIntakeForBrand(request.brandId, reviewerId, actorRole);
  }

  return request;
}

export async function getFreshChangeRequestTargetContext(brandId: string) {
  const [intakeLocked, sections, modules] = await Promise.all([
    latestIntakeIsLocked(brandId),
    getIntakeSectionsWithQuestions(),
    getBrandModulesForChangeRequests(brandId),
  ]);

  return {
    intakeLocked,
    sections,
    modules,
  };
}
