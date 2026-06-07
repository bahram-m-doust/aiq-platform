import "server-only";

import { after } from "next/server";

import {
  buildIntakeFinalSubmitAfterAudit,
  buildIntakeFinalSubmitBeforeAudit,
  buildIntakeSnapshotJson,
  calculateIntakeCompletion,
  canApproveIntakeRole,
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
  AutosaveIntakeAnswersInput,
  AutosaveIntakeAnswersResult,
  FinalSubmitIntakeResult,
  IntakeAnswerValue,
  IntakeQuestion,
  IntakeSession,
} from "@/features/intake/types";
import { createIntakeKnowledgeFile } from "@/features/intake/intake-knowledge";
import { loadUserProfileByAuthUserId } from "@/features/auth/profile";
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

type AnswerRow = {
  id: string;
  value: unknown;
};

type QuestionRow = {
  id: string;
  input_type: string;
};

type FastAutosaveRow = {
  ok: boolean;
  message: string | null;
  question_id: string | null;
  answer_id: string | null;
  previous_value: unknown;
  value: unknown;
  input_type: string | null;
  brand_id: string | null;
  actor_profile_id: string | null;
  actor_role: string | null;
  completion_percent: number | null;
};

type BatchAutosaveRow = FastAutosaveRow;

type SnapshotRow = {
  id: string;
};

const CODE = "final_submit_intake";
const FAST_AUTOSAVE_RPC_RETRY_MS = 60_000;
const BATCH_AUTOSAVE_RPC_RETRY_MS = 60_000;
let fastAutosaveRpcRetryAt = 0;
let batchAutosaveRpcRetryAt = 0;

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

function batchErrorResult(
  message: string,
  failedQuestionIds?: string[],
): AutosaveIntakeAnswersResult {
  return { ok: false, message, failedQuestionIds };
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

type IntakeAnswerAuditInput = {
  actorUserId: string;
  actorRole?: string | null;
  brandId: string;
  sessionId: string;
  question: IntakeQuestion;
  answerId: string;
  previousAnswer: AnswerRow | null;
  nextAnswer: AnswerRow;
  completionPercent: number;
};

function scheduleBestEffortIntakeAnswerAudits(
  inputs: IntakeAnswerAuditInput[],
) {
  if (inputs.length === 0) {
    return;
  }

  const task = async () => {
    for (const input of inputs) {
      try {
        await auditIntakeAnswerUpdated(input);
      } catch (error) {
        logServerError({
          label: "[intake] autosave audit failed",
          error,
          metadata: {
            brandId: input.brandId,
            sessionId: input.sessionId,
            questionId: input.question.id,
          },
        });
      }
    }
  };

  try {
    after(task);
  } catch {
    void task();
  }
}

function scheduleBestEffortIntakeAnswerAudit(input: IntakeAnswerAuditInput) {
  scheduleBestEffortIntakeAnswerAudits([input]);
}

function firstFastAutosaveRow(data: unknown): FastAutosaveRow | null {
  if (Array.isArray(data)) {
    return (data[0] as FastAutosaveRow | undefined) ?? null;
  }

  return (data as FastAutosaveRow | null) ?? null;
}

function autosaveRows(data: unknown): BatchAutosaveRow[] {
  if (Array.isArray(data)) {
    return data as BatchAutosaveRow[];
  }

  return data ? [data as BatchAutosaveRow] : [];
}

function isMissingAutosaveRpcError(error: unknown, rpcName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const message = typeof record.message === "string" ? record.message : "";

  return (
    record.code === "PGRST202" &&
    message.includes(rpcName)
  );
}

function isMissingFastAutosaveRpcError(error: unknown) {
  return isMissingAutosaveRpcError(error, "autosave_intake_answer_fast");
}

function isMissingBatchAutosaveRpcError(error: unknown) {
  return isMissingAutosaveRpcError(error, "autosave_intake_answers_batch");
}

function isBrokenAutosaveRpcError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const message = typeof record.message === "string" ? record.message : "";

  return (
    record.code === "42702" &&
    message.includes("column reference") &&
    message.includes("ambiguous")
  );
}

async function autosaveIntakeAnswerLegacy({
  input,
  authUserId,
}: {
  input: AutosaveIntakeAnswerInput;
  authUserId: string;
}): Promise<AutosaveIntakeAnswerResult> {
  const profile = await loadUserProfileByAuthUserId({
    authUserId,
    context: "autosaveIntakeAnswer.legacyProfile",
  });

  if (!profile) {
    return errorResult("You do not have permission to answer this intake.");
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
    profileId: profile.id,
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
    profileId: profile.id,
  });
  const completion = await calculateAndPersistCompletion(session.id);

  scheduleBestEffortIntakeAnswerAudit({
    actorUserId: profile.id,
    actorRole: profile.global_role,
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

async function autosaveIntakeAnswerSingle({
  input,
  authUserId,
}: {
  input: AutosaveIntakeAnswerInput;
  authUserId: string;
}): Promise<AutosaveIntakeAnswerResult> {
  if (!input.sessionId || !input.questionId) {
    return errorResult("The intake answer could not be saved.");
  }

  if (Date.now() < fastAutosaveRpcRetryAt) {
    return autosaveIntakeAnswerLegacy({ input, authUserId });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("autosave_intake_answer_fast", {
    p_session_id: input.sessionId,
    p_question_id: input.questionId,
    p_auth_user_id: authUserId,
    p_value: input.value ?? null,
  });

  if (error) {
    if (isMissingFastAutosaveRpcError(error) || isBrokenAutosaveRpcError(error)) {
      fastAutosaveRpcRetryAt = Date.now() + FAST_AUTOSAVE_RPC_RETRY_MS;
      return autosaveIntakeAnswerLegacy({ input, authUserId });
    }

    logServerError({
      label: "[intake] fast autosave failed",
      error,
      metadata: { sessionId: input.sessionId, questionId: input.questionId },
    });
    return errorResult("The intake answer could not be saved.");
  }

  fastAutosaveRpcRetryAt = 0;

  const row = firstFastAutosaveRow(data);

  if (!row?.ok) {
    return errorResult(row?.message ?? "The intake answer could not be saved.");
  }

  if (
    !row.question_id ||
    !row.answer_id ||
    !row.input_type ||
    !row.brand_id ||
    !row.actor_profile_id ||
    typeof row.completion_percent !== "number"
  ) {
    return errorResult("The intake answer could not be saved.");
  }

  const question: IntakeQuestion = {
    id: row.question_id,
    sectionId: "",
    key: "",
    questionText: "",
    helpText: null,
    inputType: row.input_type,
    isRequired: true,
    orderIndex: 0,
    validationSchema: null,
  };
  const normalizedValue = extractStoredAnswerValue({
    inputType: row.input_type,
    storedValue: row.value,
  });
  const answer = { id: row.answer_id, value: row.value };
  const previousAnswer =
    row.previous_value == null
      ? null
      : { id: row.answer_id, value: row.previous_value };

  scheduleBestEffortIntakeAnswerAudit({
    actorUserId: row.actor_profile_id,
    actorRole: row.actor_role,
    brandId: row.brand_id,
    sessionId: input.sessionId,
    question,
    answerId: answer.id,
    previousAnswer,
    nextAnswer: answer,
    completionPercent: row.completion_percent,
  });

  return {
    ok: true,
    questionId: row.question_id,
    value: normalizedValue,
    completionPercent: row.completion_percent,
  };
}

async function autosaveIntakeAnswersFallbackSequential({
  input,
  authUserId,
}: {
  input: AutosaveIntakeAnswersInput;
  authUserId: string;
}): Promise<AutosaveIntakeAnswersResult> {
  const savedAnswers: Array<{ questionId: string; value: IntakeAnswerValue }> =
    [];
  let completionPercent = 0;

  for (const answerInput of input.answers) {
    const result = await autosaveIntakeAnswerSingle({
      input: {
        sessionId: input.sessionId,
        questionId: answerInput.questionId,
        value: answerInput.value,
      },
      authUserId,
    });

    if (!result.ok) {
      return batchErrorResult(result.message, [answerInput.questionId]);
    }

    savedAnswers.push({
      questionId: result.questionId,
      value: result.value,
    });
    completionPercent = result.completionPercent;
  }

  return {
    ok: true,
    answers: savedAnswers,
    completionPercent,
  };
}

function normalizeAutosaveBatchInput(input: AutosaveIntakeAnswersInput) {
  const answerByQuestionId = new Map<string, unknown>();

  input.answers.forEach((answer) => {
    const questionId = answer.questionId.trim();
    if (questionId) {
      answerByQuestionId.set(questionId, answer.value);
    }
  });

  return Array.from(answerByQuestionId, ([questionId, value]) => ({
    questionId,
    value,
  }));
}

export async function autosaveIntakeAnswers({
  input,
  authUserId,
}: {
  input: AutosaveIntakeAnswersInput;
  authUserId: string;
}): Promise<AutosaveIntakeAnswersResult> {
  const answers = normalizeAutosaveBatchInput(input);
  const failedQuestionIds = answers.map((answer) => answer.questionId);

  if (!input.sessionId || answers.length === 0) {
    return batchErrorResult(
      "The intake answer could not be saved.",
      failedQuestionIds,
    );
  }

  const normalizedInput: AutosaveIntakeAnswersInput = {
    sessionId: input.sessionId,
    answers,
  };

  if (Date.now() < batchAutosaveRpcRetryAt) {
    return autosaveIntakeAnswersFallbackSequential({
      input: normalizedInput,
      authUserId,
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("autosave_intake_answers_batch", {
    p_session_id: input.sessionId,
    p_auth_user_id: authUserId,
    p_answers: answers.map((answer) => ({
      question_id: answer.questionId,
      value: answer.value ?? null,
    })),
  });

  if (error) {
    if (isMissingBatchAutosaveRpcError(error) || isBrokenAutosaveRpcError(error)) {
      batchAutosaveRpcRetryAt = Date.now() + BATCH_AUTOSAVE_RPC_RETRY_MS;
      return autosaveIntakeAnswersFallbackSequential({
        input: normalizedInput,
        authUserId,
      });
    }

    logServerError({
      label: "[intake] batch autosave failed",
      error,
      metadata: {
        sessionId: input.sessionId,
        questionIds: failedQuestionIds,
      },
    });
    return batchErrorResult(
      "The intake answer could not be saved.",
      failedQuestionIds,
    );
  }

  batchAutosaveRpcRetryAt = 0;

  const rows = autosaveRows(data);
  const failedRow = rows.find((row) => !row.ok);

  if (failedRow) {
    return batchErrorResult(
      failedRow.message ?? "The intake answer could not be saved.",
      failedQuestionIds,
    );
  }

  if (rows.length !== answers.length) {
    return batchErrorResult(
      "The intake answer could not be saved.",
      failedQuestionIds,
    );
  }

  const auditInputs: IntakeAnswerAuditInput[] = [];
  const savedAnswers: Array<{ questionId: string; value: IntakeAnswerValue }> =
    [];
  let completionPercent = 0;

  for (const row of rows) {
    if (
      !row.question_id ||
      !row.answer_id ||
      !row.input_type ||
      !row.brand_id ||
      !row.actor_profile_id ||
      typeof row.completion_percent !== "number"
    ) {
      return batchErrorResult(
        "The intake answer could not be saved.",
        failedQuestionIds,
      );
    }

    const question: IntakeQuestion = {
      id: row.question_id,
      sectionId: "",
      key: "",
      questionText: "",
      helpText: null,
      inputType: row.input_type,
      isRequired: true,
      orderIndex: 0,
      validationSchema: null,
    };
    const normalizedValue = extractStoredAnswerValue({
      inputType: row.input_type,
      storedValue: row.value,
    });
    const answer = { id: row.answer_id, value: row.value };
    const previousAnswer =
      row.previous_value == null
        ? null
        : { id: row.answer_id, value: row.previous_value };

    savedAnswers.push({
      questionId: row.question_id,
      value: normalizedValue,
    });
    completionPercent = row.completion_percent;
    auditInputs.push({
      actorUserId: row.actor_profile_id,
      actorRole: row.actor_role,
      brandId: row.brand_id,
      sessionId: input.sessionId,
      question,
      answerId: answer.id,
      previousAnswer,
      nextAnswer: answer,
      completionPercent: row.completion_percent,
    });
  }

  scheduleBestEffortIntakeAnswerAudits(auditInputs);

  return {
    ok: true,
    answers: savedAnswers,
    completionPercent,
  };
}

export async function autosaveIntakeAnswer({
  input,
  authUserId,
}: {
  input: AutosaveIntakeAnswerInput;
  authUserId: string;
}): Promise<AutosaveIntakeAnswerResult> {
  const result = await autosaveIntakeAnswers({
    input: {
      sessionId: input.sessionId,
      answers: [
        {
          questionId: input.questionId,
          value: input.value,
        },
      ],
    },
    authUserId,
  });

  if (!result.ok) {
    return errorResult(result.message);
  }

  const savedAnswer =
    result.answers.find((answer) => answer.questionId === input.questionId) ??
    result.answers[0];

  if (!savedAnswer) {
    return errorResult("The intake answer could not be saved.");
  }

  return {
    ok: true,
    questionId: savedAnswer.questionId,
    value: savedAnswer.value,
    completionPercent: result.completionPercent,
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

  if (!canApproveIntakeRole(access.membershipRole)) {
    finalSubmitError(
      "Only the brand Owner can approve and lock the questionnaire.",
    );
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
