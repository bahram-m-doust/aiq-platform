import "server-only";

import {
  buildIntakeFinalSubmitAfterAudit,
  buildIntakeFinalSubmitBeforeAudit,
  buildIntakeSnapshotJson,
  calculateIntakeCompletion,
  extractStoredAnswerValue,
  flattenIntakeQuestions,
  isIntakeAnswerComplete,
  normalizeIntakeAnswerValue,
  toStoredAnswerValue,
  validateFinalSubmitCompletion,
} from "@/features/intake/schemas";
import { createIntakeInternalNotificationPlaceholder } from "@/features/intake/notifications";
import {
  getIntakeAccessForProfile,
  getIntakeAnswersForSession,
  getIntakeSectionsWithQuestions,
  getLatestIntakeSessionForBrand,
} from "@/features/intake/queries";
import type {
  AutosaveIntakeAnswerInput,
  AutosaveIntakeAnswerResult,
  FinalSubmitIntakeResult,
  IntakeQuestion,
  IntakeSession,
} from "@/features/intake/types";
import { createIntakeKnowledgeFile } from "@/features/intake/intake-knowledge";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { logServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

type IntakeSessionRow = {
  id: string;
  brand_id: string;
  status: string;
  completion_percent: number | null;
  locked_at: string | null;
  locked_by: string | null;
};

type QuestionRow = {
  id: string;
  input_type: string;
};

type AnswerRow = {
  id: string;
  value: unknown;
};

type SnapshotRow = {
  id: string;
};

const CODE = "final_submit_intake";

function finalSubmitError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isFinalSubmitIntakeError(
  error: unknown,
): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

function toIntakeSession(row: IntakeSessionRow): IntakeSession {
  return {
    id: row.id,
    brandId: row.brand_id,
    status: row.status,
    completionPercent: row.completion_percent ?? 0,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
  };
}

function errorResult(message: string): AutosaveIntakeAnswerResult {
  return { ok: false, message };
}

export async function ensureIntakeSessionForBrand(brandId: string) {
  const existing = await getLatestIntakeSessionForBrand(brandId);

  if (existing) {
    return existing;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("intake_sessions")
    .insert({
      brand_id: brandId,
      status: "DRAFT",
      completion_percent: 0,
    })
    .select("id, brand_id, status, completion_percent, locked_at, locked_by")
    .single();

  if (error) {
    throw error;
  }

  return toIntakeSession(data as unknown as IntakeSessionRow);
}

async function getQuestion(questionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("questions")
    .select("id, input_type")
    .eq("id", questionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as QuestionRow | null;
}

async function getSession(sessionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("intake_sessions")
    .select("id, brand_id, status, completion_percent, locked_at, locked_by")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toIntakeSession(data as unknown as IntakeSessionRow) : null;
}

async function calculateAndPersistCompletion(sessionId: string) {
  const sections = await getIntakeSectionsWithQuestions();
  const questions = flattenIntakeQuestions(sections);
  const answers = await getIntakeAnswersForSession({ sessionId, questions });
  const completion = calculateIntakeCompletion({ sections, answers });
  const admin = createAdminClient();
  const { error } = await admin
    .from("intake_sessions")
    .update({
      completion_percent: completion.completionPercent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    throw error;
  }

  return completion;
}

async function upsertAnswer({
  sessionId,
  questionId,
  value,
  profileId,
}: {
  sessionId: string;
  questionId: string;
  value: unknown;
  profileId: string;
}) {
  const admin = createAdminClient();
  const { data: previousAnswer, error: previousError } = await admin
    .from("intake_answers")
    .select("id, value")
    .eq("session_id", sessionId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (previousError) {
    throw previousError;
  }

  const { data, error } = await admin
    .from("intake_answers")
    .upsert(
      {
        session_id: sessionId,
        question_id: questionId,
        value,
        updated_by: profileId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "session_id,question_id",
      },
    )
    .select("id, value")
    .single();

  if (error) {
    throw error;
  }

  return {
    answer: data as unknown as AnswerRow,
    previousAnswer: previousAnswer as AnswerRow | null,
  };
}

function auditAnswerState({
  question,
  answerValue,
}: {
  question: IntakeQuestion;
  answerValue: unknown;
}) {
  const normalized = extractStoredAnswerValue({
    inputType: question.inputType,
    storedValue: answerValue,
  });

  return {
    answered: isIntakeAnswerComplete(normalized),
  };
}

async function auditIntakeAnswerUpdated({
  actorUserId,
  actorRole,
  brandId,
  sessionId,
  question,
  answerId,
  previousAnswer,
  nextAnswer,
  completionPercent,
}: {
  actorUserId: string;
  actorRole?: string | null;
  brandId: string;
  sessionId: string;
  question: IntakeQuestion;
  answerId: string;
  previousAnswer: AnswerRow | null;
  nextAnswer: AnswerRow;
  completionPercent: number;
}) {
  await logAudit({
    actorUserId,
    actorRole: actorRole ?? null,
    brandId,
    action: "intake_answer_updated",
    entityType: "intake_answer",
    entityId: answerId,
    before: previousAnswer
      ? {
          session_id: sessionId,
          question_id: question.id,
          ...auditAnswerState({
            question,
            answerValue: previousAnswer.value,
          }),
        }
      : null,
    after: {
      session_id: sessionId,
      question_id: question.id,
      completion_percent: completionPercent,
      ...auditAnswerState({
        question,
        answerValue: nextAnswer.value,
      }),
    },
  });
}

export async function autosaveIntakeAnswer({
  input,
  profileId,
  actorRole,
}: {
  input: AutosaveIntakeAnswerInput;
  profileId: string;
  actorRole?: string | null;
}): Promise<AutosaveIntakeAnswerResult> {
  if (!input.sessionId || !input.questionId) {
    return errorResult("The intake answer could not be saved.");
  }

  const [session, questionRow] = await Promise.all([
    getSession(input.sessionId),
    getQuestion(input.questionId),
  ]);

  if (!session || !questionRow) {
    return errorResult("The intake answer could not be saved.");
  }

  if (session.status === "LOCKED" || session.lockedAt) {
    return errorResult("This intake session is locked and cannot be edited.");
  }

  const access = await getIntakeAccessForProfile({
    profileId,
    brandId: session.brandId,
  });

  if (!access) {
    return errorResult("You do not have permission to answer this intake.");
  }

  const sections = await getIntakeSectionsWithQuestions();
  const question = flattenIntakeQuestions(sections).find(
    (item) => item.id === input.questionId,
  );

  if (!question) {
    return errorResult("The intake question could not be found.");
  }

  const normalizedValue = normalizeIntakeAnswerValue({
    inputType: questionRow.input_type,
    value: input.value,
  });
  const { answer, previousAnswer } = await upsertAnswer({
    sessionId: session.id,
    questionId: question.id,
    value: toStoredAnswerValue(normalizedValue),
    profileId,
  });
  const completion = await calculateAndPersistCompletion(session.id);

  await auditIntakeAnswerUpdated({
    actorUserId: profileId,
    actorRole,
    brandId: session.brandId,
    sessionId: session.id,
    question,
    answerId: answer.id,
    previousAnswer,
    nextAnswer: answer,
    completionPercent: completion.completionPercent,
  });

  return {
    ok: true,
    questionId: question.id,
    value: normalizedValue,
    completionPercent: completion.completionPercent,
  };
}

export async function finalSubmitIntake({
  sessionId,
  profileId,
  actorRole,
}: {
  sessionId: string;
  profileId: string;
  actorRole?: string | null;
}): Promise<FinalSubmitIntakeResult> {
  if (!sessionId) {
    finalSubmitError("The intake session could not be submitted.");
  }

  const session = await getSession(sessionId);

  if (!session) {
    finalSubmitError("The intake session could not be found.");
  }

  const access = await getIntakeAccessForProfile({
    profileId,
    brandId: session.brandId,
  });

  if (!access) {
    finalSubmitError("You do not have permission to submit this intake.");
  }

  const sections = await getIntakeSectionsWithQuestions();
  const questions = flattenIntakeQuestions(sections);
  const answers = await getIntakeAnswersForSession({
    sessionId: session.id,
    questions,
  });
  const completion = calculateIntakeCompletion({ sections, answers });
  const validationError = validateFinalSubmitCompletion({
    session,
    completion,
  });

  if (validationError) {
    finalSubmitError(validationError);
  }

  const lockedAt = new Date().toISOString();
  const snapshotJson = buildIntakeSnapshotJson({
    access,
    session,
    sections,
    answers,
    completion,
    submittedAt: lockedAt,
    submittedBy: profileId,
  });
  const admin = createAdminClient();
  const { data: lockedSessionData, error: lockError } = await admin
    .from("intake_sessions")
    .update({
      status: "LOCKED",
      completion_percent: completion.completionPercent,
      locked_at: lockedAt,
      locked_by: profileId,
      updated_at: lockedAt,
    })
    .eq("id", session.id)
    .eq("brand_id", session.brandId)
    .neq("status", "LOCKED")
    .is("locked_at", null)
    .select("id, brand_id, status, completion_percent, locked_at, locked_by")
    .maybeSingle();

  if (lockError) {
    throw lockError;
  }

  if (!lockedSessionData) {
    finalSubmitError("This intake session is already locked.");
  }

  const lockedSession = toIntakeSession(
    lockedSessionData as unknown as IntakeSessionRow,
  );
  const { data: snapshotData, error: snapshotError } = await admin
    .from("intake_snapshots")
    .insert({
      session_id: session.id,
      brand_id: session.brandId,
      snapshot_json: snapshotJson,
    })
    .select("id")
    .single();

  if (snapshotError) {
    throw snapshotError;
  }

  const snapshotId = (snapshotData as unknown as SnapshotRow).id;
  const notification = createIntakeInternalNotificationPlaceholder({
    brandId: session.brandId,
    sessionId: session.id,
    snapshotId,
    createdAt: lockedAt,
  });
  await logAudit({
    actorUserId: profileId,
    actorRole: actorRole ?? null,
    brandId: session.brandId,
    action: "intake_final_submitted",
    entityType: "intake_session",
    entityId: session.id,
    before: buildIntakeFinalSubmitBeforeAudit({
      session,
      completion,
    }),
    after: buildIntakeFinalSubmitAfterAudit({
      session: lockedSession,
      snapshotId,
      completion,
      notification,
    }),
  });

  try {
    await createIntakeKnowledgeFile({
      brandId: session.brandId,
      snapshotId,
      snapshotJson,
      profileId,
    });
  } catch (error) {
    logServerError({
      label: "[intake] knowledge file generation failed",
      error,
      metadata: { snapshotId, brandId: session.brandId },
    });
  }

  return {
    brandId: session.brandId,
    sessionId: session.id,
    snapshotId,
    lockedAt,
    completionPercent: completion.completionPercent,
    sectionKeys: sections.map((section) => section.key),
  };
}
