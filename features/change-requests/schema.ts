import type { GlobalRole } from "@/features/auth/types";
import type {
  ChangeRequestCreateOptions,
  ChangeRequestModuleOption,
  ChangeRequestQuestionOption,
  ChangeRequestRecord,
  ChangeRequestReviewItem,
  ChangeRequestStatus,
  ChangeRequestTargetContext,
  ChangeRequestTargetType,
  CreateChangeRequestFormState,
  CreateChangeRequestInput,
  ReviewChangeRequestFormState,
  ReviewChangeRequestInput,
} from "@/features/change-requests/types";
import {
  changeRequestStatuses,
  changeRequestTargetTypes,
} from "@/features/change-requests/types";

const maxReasonLength = 240;
const maxCommentLength = 4000;
const maxResolutionNoteLength = 2000;

export const initialCreateChangeRequestFormState: CreateChangeRequestFormState =
  {
    status: "idle",
    message: "",
  };

export const initialReviewChangeRequestFormState: ReviewChangeRequestFormState =
  {
    status: "idle",
    message: "",
  };

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: string) {
  return value.length > 0 ? value : null;
}

export function canCreateChangeRequestRole(role: string | null | undefined) {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function canReviewChangeRequestRole(role: string | null | undefined) {
  return role === "PLATFORM_OWNER" || role === "SUPERVISOR";
}

export function isChangeRequestStatus(
  value: string,
): value is ChangeRequestStatus {
  return changeRequestStatuses.includes(value as ChangeRequestStatus);
}

export function isChangeRequestTargetType(
  value: string,
): value is ChangeRequestTargetType {
  return changeRequestTargetTypes.includes(value as ChangeRequestTargetType);
}

export function validateCreateChangeRequestFormData(
  formData: FormData,
): { data: CreateChangeRequestInput | null; error: string | null } {
  const targetType = formString(formData, "target_type");
  const sectionKey = formString(formData, "section_key");
  const questionTarget = formString(formData, "question_target");
  const moduleId = formString(formData, "module_id");
  const reason = formString(formData, "reason");
  const comment = formString(formData, "comment");

  if (!isChangeRequestTargetType(targetType)) {
    return { data: null, error: "Choose a valid request target." };
  }

  if (!reason) {
    return { data: null, error: "Enter the reason for this request." };
  }

  if (reason.length > maxReasonLength) {
    return {
      data: null,
      error: `Reason must be ${maxReasonLength} characters or fewer.`,
    };
  }

  if (!comment) {
    return { data: null, error: "Enter the requested correction details." };
  }

  if (comment.length > maxCommentLength) {
    return {
      data: null,
      error: `Comment must be ${maxCommentLength} characters or fewer.`,
    };
  }

  let parsedSectionKey: string | null = null;
  let parsedQuestionId: string | null = null;

  if (targetType === "INTAKE_SECTION") {
    parsedSectionKey = sectionKey;
  }

  if (targetType === "INTAKE_QUESTION") {
    const [questionSectionKey, questionId] = questionTarget.split(":");
    parsedSectionKey = questionSectionKey?.trim() || null;
    parsedQuestionId = questionId?.trim() || null;
  }

  return {
    data: {
      targetType,
      sectionKey: normalizeOptionalText(parsedSectionKey ?? ""),
      questionId: normalizeOptionalText(parsedQuestionId ?? ""),
      moduleId: targetType === "MODULE" ? normalizeOptionalText(moduleId) : null,
      reason,
      comment,
    },
    error: null,
  };
}

export function validateReviewChangeRequestFormData(
  formData: FormData,
): { data: ReviewChangeRequestInput | null; error: string | null } {
  const requestId = formString(formData, "request_id");
  const status = formString(formData, "status");
  const resolutionNote = formString(formData, "resolution_note");

  if (!requestId) {
    return { data: null, error: "Change Request is missing." };
  }

  if (!isChangeRequestStatus(status)) {
    return { data: null, error: "Choose a valid review status." };
  }

  if (resolutionNote.length > maxResolutionNoteLength) {
    return {
      data: null,
      error: `Resolution note must be ${maxResolutionNoteLength} characters or fewer.`,
    };
  }

  return {
    data: {
      requestId,
      status,
      resolutionNote: normalizeOptionalText(resolutionNote),
    },
    error: null,
  };
}

export function getQuestionOptions(
  sections: ChangeRequestCreateOptions["sections"],
): ChangeRequestQuestionOption[] {
  return sections.flatMap((section) =>
    section.questions.map((question) => ({
      ...question,
      sectionKey: section.key,
      sectionTitle: section.title,
    })),
  );
}

export function validateChangeRequestTargetContext({
  input,
  context,
}: {
  input: CreateChangeRequestInput;
  context: ChangeRequestTargetContext;
}) {
  if (
    input.targetType === "INTAKE_SECTION" ||
    input.targetType === "INTAKE_QUESTION"
  ) {
    if (!context.intakeLocked) {
      return "Intake Change Requests are available only after Final Submit locks the intake.";
    }

    if (input.targetType === "INTAKE_QUESTION") {
      const section = context.sections.find(
        (item) => item.key === input.sectionKey,
      );

      if (!section) {
        return "Choose a valid intake section.";
      }

      const question = section.questions.find(
        (item) => item.id === input.questionId,
      );

      if (!question) {
        return "Choose a valid intake question.";
      }
    }

    if (input.targetType === "INTAKE_SECTION" && input.sectionKey) {
      const section = context.sections.find(
        (item) => item.key === input.sectionKey,
      );

      if (!section) {
        return "Choose a valid intake section.";
      }
    }
  }

  if (input.targetType === "MODULE") {
    const brandModule = context.modules.find(
      (item) => item.id === input.moduleId,
    );

    if (!brandModule) {
      return "Choose a valid brand module.";
    }
  }

  return null;
}

export function targetLabelForRequest({
  request,
  sections,
  modules,
}: {
  request: Pick<
    ChangeRequestRecord,
    "targetType" | "targetId" | "sectionKey" | "questionId"
  >;
  sections: ChangeRequestCreateOptions["sections"];
  modules: ChangeRequestModuleOption[];
}) {
  if (request.targetType === "MODULE") {
    const brandModule = modules.find((item) => item.id === request.targetId);
    return brandModule
      ? `Module: ${brandModule.title}`
      : `Module: ${request.targetId ?? "Unknown"}`;
  }

  const section = sections.find((item) => item.key === request.sectionKey);

  if (request.targetType === "INTAKE_SECTION") {
    if (!request.sectionKey) {
      return "Questionnaire";
    }

    return section
      ? `Intake section: ${section.title}`
      : `Intake section: ${request.sectionKey ?? "Unknown"}`;
  }

  const question = section?.questions.find(
    (item) => item.id === request.questionId,
  );

  return question
    ? `Intake question: ${question.questionText}`
    : `Intake question: ${request.questionId ?? "Unknown"}`;
}

export function toChangeRequestCreatedAudit({
  request,
}: {
  request: ChangeRequestRecord;
}) {
  return {
    request_id: request.id,
    brand_id: request.brandId,
    target_type: request.targetType,
    target_id: request.targetId,
    section_key: request.sectionKey,
    question_id: request.questionId,
    requested_by: request.requestedBy,
    status: request.status,
    reason_present: Boolean(request.reason),
    comment_length: request.comment.length,
  };
}

export function toChangeRequestStatusBeforeAudit(
  request: ChangeRequestRecord,
) {
  return {
    request_id: request.id,
    brand_id: request.brandId,
    status: request.status,
    reviewed_by: request.reviewedBy,
    resolution_note_present: Boolean(request.resolutionNote),
  };
}

export function toChangeRequestStatusAfterAudit({
  request,
  previousStatus,
}: {
  request: ChangeRequestRecord;
  previousStatus: ChangeRequestStatus;
}) {
  return {
    request_id: request.id,
    brand_id: request.brandId,
    target_type: request.targetType,
    previous_status: previousStatus,
    status: request.status,
    reviewed_by: request.reviewedBy,
    resolution_note_present: Boolean(request.resolutionNote),
  };
}

export function reviewAccessDeniedRedirectPath(role: GlobalRole) {
  return canReviewChangeRequestRole(role) ? null : "/home";
}

export function sortChangeRequestsByCreatedAt(
  requests: ChangeRequestReviewItem[],
) {
  return [...requests].sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return rightTime - leftTime;
  });
}
