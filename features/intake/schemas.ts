import type {
  IntakeAnswerMap,
  IntakeAnswerValue,
  IntakeCompletion,
  FinalSubmitIntakeFormState,
  IntakeInputKind,
  IntakeInternalNotificationPlaceholder,
  IntakeQuestion,
  IntakeQuestionOption,
  IntakeSectionProgress,
  IntakeSectionWithQuestions,
  IntakeSession,
  IntakeSnapshotJson,
} from "@/features/intake/types";

const textInputTypes = new Set(["text", "short_text", "short-text"]);
const textareaInputTypes = new Set([
  "textarea",
  "long_text",
  "long-text",
  "markdown",
]);
const multiSelectInputTypes = new Set([
  "multi_select",
  "multi-select",
  "multiselect",
  "checkbox_group",
  "checkbox-group",
]);

export const finalSubmitConfirmationCopy =
  "Final submission will lock your answers and initiate the strategic development process. After this point, direct editing will be disabled. Any required correction must be submitted as a Change Request.";

export const initialFinalSubmitIntakeFormState: FinalSubmitIntakeFormState = {
  status: "idle",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];

  return Array.from(
    new Set(
      values
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function canAnswerIntakeRole(role: string | null | undefined) {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function isIntakeSessionLocked(session: IntakeSession) {
  return session.status === "LOCKED" || Boolean(session.lockedAt);
}

export function resolveQuestionInputKind(inputType: string): IntakeInputKind {
  const normalized = inputType.trim().toLowerCase();

  if (textInputTypes.has(normalized)) {
    return "text";
  }

  if (textareaInputTypes.has(normalized)) {
    return "textarea";
  }

  if (normalized === "url" || normalized === "website") {
    return "url";
  }

  if (normalized === "number" || normalized === "numeric") {
    return "number";
  }

  if (normalized === "select" || normalized === "dropdown") {
    return "select";
  }

  if (normalized === "radio" || normalized === "single_choice") {
    return "radio";
  }

  if (normalized === "checkbox" || normalized === "boolean") {
    return "checkbox";
  }

  if (multiSelectInputTypes.has(normalized)) {
    return "multi_select";
  }

  return "textarea";
}

export function parseQuestionOptions(
  validationSchema: unknown,
): IntakeQuestionOption[] {
  if (!isRecord(validationSchema) || !Array.isArray(validationSchema.options)) {
    return [];
  }

  return validationSchema.options
    .map((option): IntakeQuestionOption | null => {
      if (typeof option === "string") {
        const value = option.trim();
        return value ? { label: value, value } : null;
      }

      if (!isRecord(option)) {
        return null;
      }

      const value =
        typeof option.value === "string" || typeof option.value === "number"
          ? String(option.value).trim()
          : "";
      const label = typeof option.label === "string" ? option.label.trim() : value;

      return value ? { label: label || value, value } : null;
    })
    .filter((option): option is IntakeQuestionOption => Boolean(option));
}

export function normalizeIntakeAnswerValue({
  inputType,
  value,
}: {
  inputType: string;
  value: unknown;
}): IntakeAnswerValue {
  const kind = resolveQuestionInputKind(inputType);

  if (kind === "checkbox") {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
    }

    return false;
  }

  if (kind === "multi_select") {
    const values = normalizeStringArray(value);
    return values.length > 0 ? values : [];
  }

  if (kind === "number") {
    const raw = typeof value === "number" ? value : normalizeString(value);

    if (raw === "") {
      return null;
    }

    const numberValue = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  const stringValue = normalizeString(value);
  return stringValue.length > 0 ? stringValue : null;
}

export function extractStoredAnswerValue({
  inputType,
  storedValue,
}: {
  inputType: string;
  storedValue: unknown;
}) {
  if (!isRecord(storedValue) || !("value" in storedValue)) {
    return null;
  }

  return normalizeIntakeAnswerValue({
    inputType,
    value: storedValue.value,
  });
}

export function toStoredAnswerValue(value: IntakeAnswerValue) {
  return { value };
}

export function isIntakeAnswerComplete(value: IntakeAnswerValue) {
  if (value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return typeof value === "boolean";
}

function calculatePercent(answered: number, total: number) {
  return total > 0 ? Math.round((answered / total) * 100) : 0;
}

export function calculateIntakeCompletion({
  sections,
  answers,
}: {
  sections: IntakeSectionWithQuestions[];
  answers: IntakeAnswerMap;
}): IntakeCompletion {
  let totalQuestions = 0;
  let answeredQuestions = 0;

  const sectionProgress = sections.map((section): IntakeSectionProgress => {
    const total = section.questions.length;
    const answered = section.questions.filter((question) =>
      isIntakeAnswerComplete(answers[question.id] ?? null),
    ).length;

    totalQuestions += total;
    answeredQuestions += answered;

    return {
      sectionId: section.id,
      sectionKey: section.key,
      title: section.title,
      totalQuestions: total,
      answeredQuestions: answered,
      completionPercent: calculatePercent(answered, total),
    };
  });

  return {
    totalQuestions,
    answeredQuestions,
    completionPercent: calculatePercent(answeredQuestions, totalQuestions),
    sections: sectionProgress,
  };
}

export function flattenIntakeQuestions(sections: IntakeSectionWithQuestions[]) {
  return sections.flatMap((section): IntakeQuestion[] => section.questions);
}

export function validateFinalSubmitCompletion({
  session,
  completion,
}: {
  session: IntakeSession;
  completion: IntakeCompletion;
}) {
  if (isIntakeSessionLocked(session)) {
    return "This intake session is already locked.";
  }

  if (completion.totalQuestions === 0) {
    return "The intake question bank is not ready for final submission.";
  }

  if (
    completion.completionPercent !== 100 ||
    completion.answeredQuestions !== completion.totalQuestions
  ) {
    return "Final Submit is available only after every question is complete.";
  }

  return null;
}

export function buildIntakeSnapshotJson({
  access,
  session,
  sections,
  answers,
  completion,
  submittedAt,
  submittedBy,
}: {
  access: {
    brandId: string;
    brandName: string;
    planName: string | null;
    membershipRole: "OWNER" | "EXECUTIVE_MANAGER";
  };
  session: IntakeSession;
  sections: IntakeSectionWithQuestions[];
  answers: IntakeAnswerMap;
  completion: IntakeCompletion;
  submittedAt: string;
  submittedBy: string;
}): IntakeSnapshotJson {
  return {
    version: 1,
    submittedAt,
    submittedBy,
    brand: {
      id: access.brandId,
      name: access.brandName,
      planName: access.planName,
      membershipRole: access.membershipRole,
    },
    session: {
      id: session.id,
      status: "LOCKED",
      lockedAt: submittedAt,
      lockedBy: submittedBy,
      completionPercent: completion.completionPercent,
    },
    completion,
    sections: sections.map((section) => ({
      id: section.id,
      key: section.key,
      title: section.title,
      description: section.description,
      orderIndex: section.orderIndex,
      questions: section.questions.map((question) => ({
        id: question.id,
        key: question.key,
        questionText: question.questionText,
        helpText: question.helpText,
        inputType: question.inputType,
        orderIndex: question.orderIndex,
        answer: {
          value: answers[question.id] ?? null,
        },
      })),
    })),
  };
}

export function buildIntakeFinalSubmitBeforeAudit({
  session,
  completion,
}: {
  session: IntakeSession;
  completion: IntakeCompletion;
}) {
  return {
    session_id: session.id,
    brand_id: session.brandId,
    status: session.status,
    locked_at: session.lockedAt,
    locked_by: session.lockedBy,
    completion_percent: completion.completionPercent,
    total_questions: completion.totalQuestions,
    answered_questions: completion.answeredQuestions,
  };
}

export function buildIntakeFinalSubmitAfterAudit({
  session,
  snapshotId,
  completion,
  notification,
}: {
  session: IntakeSession;
  snapshotId: string;
  completion: IntakeCompletion;
  notification: IntakeInternalNotificationPlaceholder;
}) {
  return {
    session_id: session.id,
    brand_id: session.brandId,
    status: session.status,
    locked_at: session.lockedAt,
    locked_by: session.lockedBy,
    snapshot_id: snapshotId,
    completion_percent: completion.completionPercent,
    total_questions: completion.totalQuestions,
    answered_questions: completion.answeredQuestions,
    internal_notification: notification,
  };
}
