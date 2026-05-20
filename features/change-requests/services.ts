import "server-only";

import {
  getIntakeSectionsWithQuestions,
  getLatestIntakeSessionForBrand,
} from "@/features/intake/queries";
import {
  canCreateChangeRequestRole,
  canReviewChangeRequestRole,
  toChangeRequestCreatedAudit,
  toChangeRequestStatusAfterAudit,
  toChangeRequestStatusBeforeAudit,
  validateChangeRequestTargetContext,
} from "@/features/change-requests/schema";
import {
  getBrandModulesForChangeRequests,
  getChangeRequestById,
  getChangeRequestCreateOptions,
  toChangeRequestRecord,
} from "@/features/change-requests/queries";
import type {
  ChangeRequestRecord,
  CreatedChangeRequestResult,
  CreateChangeRequestInput,
  ReviewChangeRequestInput,
} from "@/features/change-requests/types";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

type ChangeRequestRow = {
  id: string;
  brand_id: string;
  target_type: string;
  target_id: string | null;
  section_key: string | null;
  question_id: string | null;
  requested_by: string | null;
  reason: string | null;
  comment: string;
  status: string;
  reviewed_by: string | null;
  resolution_note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const changeRequestColumns = [
  "id",
  "brand_id",
  "target_type",
  "target_id",
  "section_key",
  "question_id",
  "requested_by",
  "reason",
  "comment",
  "status",
  "reviewed_by",
  "resolution_note",
  "created_at",
  "updated_at",
].join(", ");

class ChangeRequestError extends Error {
  name = "ChangeRequestError";
}

function changeRequestError(message: string): never {
  throw new ChangeRequestError(message);
}

export function isChangeRequestError(
  error: unknown,
): error is ChangeRequestError {
  return error instanceof ChangeRequestError;
}

async function latestIntakeIsLocked(brandId: string) {
  const session = await getLatestIntakeSessionForBrand(brandId);
  return Boolean(session && (session.status === "LOCKED" || session.lockedAt));
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
