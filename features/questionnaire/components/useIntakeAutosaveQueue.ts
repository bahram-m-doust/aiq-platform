"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { autosaveIntakeAnswersAction } from "@/features/questionnaire/actions";
import type {
  AutosaveIntakeAnswersInput,
  AutosaveIntakeAnswersResult,
  IntakeAnswerMap,
  IntakeAnswerValue,
} from "@/features/questionnaire/types";

export type AutosaveQuestionStatus =
  | "idle"
  | "queued"
  | "saving"
  | "saved"
  | "error";

export type AutosaveQuestionState = {
  status: AutosaveQuestionStatus;
  message: string;
};

type AutosaveBatchAction = (
  input: AutosaveIntakeAnswersInput,
) => Promise<AutosaveIntakeAnswersResult>;

type DraftEntry = {
  questionId: string;
  value: IntakeAnswerValue;
};

const AUTOSAVE_DEBOUNCE_MS = 350;

function serializeValue(value: IntakeAnswerValue) {
  return JSON.stringify(value);
}

function normalizeComparableValue(value: IntakeAnswerValue): IntakeAnswerValue {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(value)) {
    const values = Array.from(
      new Set(
        value
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ).sort();

    return values.length > 0 ? values : null;
  }

  return value;
}

function valuesMatch(left: IntakeAnswerValue, right: IntakeAnswerValue) {
  return (
    serializeValue(normalizeComparableValue(left)) ===
    serializeValue(normalizeComparableValue(right))
  );
}

function readDraftEntries(storageKey: string): DraftEntry[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry): DraftEntry | null => {
        if (
          !entry ||
          typeof entry !== "object" ||
          !("questionId" in entry)
        ) {
          return null;
        }

        const questionId =
          typeof entry.questionId === "string" ? entry.questionId.trim() : "";

        return questionId
          ? {
              questionId,
              value: (entry as { value: IntakeAnswerValue }).value ?? null,
            }
          : null;
      })
      .filter((entry): entry is DraftEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function writeDraftEntries(storageKey: string, entries: DraftEntry[]) {
  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    // Autosave remains server-backed even when browser storage is unavailable.
  }
}

export function useIntakeAutosaveQueue({
  sessionId,
  initialAnswers,
  autosaveAction = autosaveIntakeAnswersAction,
}: {
  sessionId: string;
  initialAnswers: IntakeAnswerMap;
  autosaveAction?: AutosaveBatchAction;
}) {
  const [answers, setAnswers] = useState<IntakeAnswerMap>(initialAnswers);
  const [saveStates, setSaveStates] = useState<
    Record<string, AutosaveQuestionState>
  >({});
  const committedValuesRef = useRef(
    new Map<string, IntakeAnswerValue>(
      Object.entries(initialAnswers).map(([questionId, value]) => [
        questionId,
        normalizeComparableValue(value),
      ]),
    ),
  );
  const draftValuesRef = useRef(new Map<string, IntakeAnswerValue>());
  const queuedValuesRef = useRef(new Map<string, IntakeAnswerValue>());
  const timerRef = useRef<number | null>(null);
  const isFlushingRef = useRef(false);
  const flushQueuedRef = useRef<(onlyQuestionIds?: string[]) => Promise<void>>(
    async () => {},
  );
  const storageKey = useMemo(
    () => `bextudio:intake-autosave:${sessionId}`,
    [sessionId],
  );

  const persistDrafts = useCallback(() => {
    writeDraftEntries(
      storageKey,
      Array.from(draftValuesRef.current, ([questionId, value]) => ({
        questionId,
        value,
      })),
    );
  }, [storageKey]);

  const setQuestionStates = useCallback(
    (questionIds: string[], state: AutosaveQuestionState) => {
      setSaveStates((current) => {
        const next = { ...current };
        questionIds.forEach((questionId) => {
          next[questionId] = state;
        });
        return next;
      });
    },
    [],
  );

  const clearQuestionState = useCallback((questionId: string) => {
    setSaveStates((current) => {
      if (!(questionId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flushQueued = useCallback(
    async (onlyQuestionIds?: string[]) => {
      if (isFlushingRef.current) {
        return;
      }

      const onlySet = onlyQuestionIds
        ? new Set(onlyQuestionIds.filter(Boolean))
        : null;
      const batch = Array.from(
        queuedValuesRef.current,
        ([questionId, value]) => ({ questionId, value }),
      ).filter((entry) => !onlySet || onlySet.has(entry.questionId));

      if (batch.length === 0) {
        return;
      }

      batch.forEach((entry) => {
        queuedValuesRef.current.delete(entry.questionId);
      });
      persistDrafts();
      isFlushingRef.current = true;
      setQuestionStates(
        batch.map((entry) => entry.questionId),
        { status: "saving", message: "" },
      );

      const requestValueByQuestionId = new Map(
        batch.map((entry) => [entry.questionId, entry.value]),
      );

      try {
        const result = await autosaveAction({
          sessionId,
          answers: batch,
        });

        if (!result.ok) {
        batch.forEach((entry) => {
            if (
              valuesMatch(
                draftValuesRef.current.get(entry.questionId) ?? null,
                entry.value,
              )
            ) {
              queuedValuesRef.current.delete(entry.questionId);
            }
          });
          persistDrafts();
          setQuestionStates(
            batch.map((entry) => entry.questionId),
            { status: "error", message: result.message },
          );
          return;
        }

        setAnswers((current) => {
          const next = { ...current };
          result.answers.forEach((answer) => {
            next[answer.questionId] = answer.value;
          });
          return next;
        });

        setSaveStates((current) => {
          const next = { ...current };
          result.answers.forEach((answer) => {
            committedValuesRef.current.set(
              answer.questionId,
              normalizeComparableValue(answer.value),
            );
            const requestValue = requestValueByQuestionId.get(answer.questionId);
            const draftValue = draftValuesRef.current.get(answer.questionId);
            const hasNewerDraft =
              draftValue !== undefined &&
              requestValue !== undefined &&
              !valuesMatch(draftValue, requestValue);

            if (hasNewerDraft) {
              next[answer.questionId] = { status: "queued", message: "" };
              return;
            }

            draftValuesRef.current.delete(answer.questionId);
            next[answer.questionId] = { status: "saved", message: "" };
          });
          persistDrafts();
          return next;
        });
      } catch {
        persistDrafts();
        setQuestionStates(
          batch.map((entry) => entry.questionId),
          {
            status: "error",
            message: "The intake answer could not be saved.",
          },
        );
      } finally {
        isFlushingRef.current = false;

        if (queuedValuesRef.current.size > 0) {
          timerRef.current = window.setTimeout(() => {
            void flushQueuedRef.current();
          }, 0);
        }
      }
    },
    [autosaveAction, persistDrafts, sessionId, setQuestionStates],
  );
  useEffect(() => {
    flushQueuedRef.current = flushQueued;
  }, [flushQueued]);

  const scheduleFlush = useCallback(
    (delayMs = AUTOSAVE_DEBOUNCE_MS) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        void flushQueued();
      }, delayMs);
    },
    [clearTimer, flushQueued],
  );

  const enqueueAnswer = useCallback(
    (
      questionId: string,
      value: IntakeAnswerValue,
      options: { flush?: boolean } = {},
    ) => {
      const committedValue = committedValuesRef.current.get(questionId) ?? null;

      if (valuesMatch(value, committedValue)) {
        draftValuesRef.current.delete(questionId);
        queuedValuesRef.current.delete(questionId);
        persistDrafts();
        setAnswers((current) => ({ ...current, [questionId]: committedValue }));
        clearQuestionState(questionId);
        return;
      }

      draftValuesRef.current.set(questionId, value);
      queuedValuesRef.current.set(questionId, value);
      persistDrafts();
      setAnswers((current) => ({ ...current, [questionId]: value }));
      setQuestionStates([questionId], { status: "queued", message: "" });

      if (options.flush) {
        void flushQueued([questionId]);
      } else {
        scheduleFlush();
      }
    },
    [
      clearQuestionState,
      flushQueued,
      persistDrafts,
      scheduleFlush,
      setQuestionStates,
    ],
  );

  const retryQuestion = useCallback(
    (questionId: string) => {
      const value = draftValuesRef.current.get(questionId);
      if (value === undefined) {
        return;
      }

      queuedValuesRef.current.set(questionId, value);
      setQuestionStates([questionId], { status: "queued", message: "" });
      void flushQueued([questionId]);
    },
    [flushQueued, setQuestionStates],
  );

  useEffect(() => {
    const drafts = readDraftEntries(storageKey);
    if (drafts.length === 0) {
      return;
    }

    const restoredQuestionIds: string[] = [];

    setAnswers((current) => {
      const next = { ...current };
      drafts.forEach((draft) => {
        const committedValue =
          committedValuesRef.current.get(draft.questionId) ?? null;
        if (valuesMatch(draft.value, committedValue)) {
          return;
        }

        next[draft.questionId] = draft.value;
        draftValuesRef.current.set(draft.questionId, draft.value);
        queuedValuesRef.current.set(draft.questionId, draft.value);
        restoredQuestionIds.push(draft.questionId);
      });
      return next;
    });

    if (restoredQuestionIds.length > 0) {
      setQuestionStates(restoredQuestionIds, { status: "queued", message: "" });
      scheduleFlush(0);
    }
  }, [scheduleFlush, setQuestionStates, storageKey]);

  useEffect(() => {
    return () => {
      clearTimer();
      persistDrafts();
    };
  }, [clearTimer, persistDrafts]);

  const hasPendingSaves = useMemo(
    () =>
      Object.values(saveStates).some((state) =>
        ["queued", "saving", "error"].includes(state.status),
      ),
    [saveStates],
  );

  return {
    answers,
    saveStates,
    enqueueAnswer,
    retryQuestion,
    flushQueued,
    hasPendingSaves,
  };
}
