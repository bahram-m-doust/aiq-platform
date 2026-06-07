"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircleIcon, LockIcon } from "lucide-react";

import { ProgressBar } from "@/components/ui/progress-bar";
import {
  calculateIntakeCompletion,
  isIntakeAnswerComplete,
  isIntakeSessionLocked,
} from "@/features/intake/schemas";
import { QuestionRenderer } from "@/features/intake/components/QuestionRenderer";
import { useIntakeAutosaveQueue } from "@/features/intake/components/useIntakeAutosaveQueue";
import type {
  IntakeAnswerMap,
  IntakeAnswerValue,
  IntakeCompletion,
  IntakeSectionWithQuestions,
  IntakeSession,
} from "@/features/intake/types";
import { cn } from "@/lib/utils";

function formatAnswerValue(value: IntakeAnswerValue) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "No answer recorded";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim().length > 0) return value;
  return "No answer recorded";
}

export function SectionQuestionnaire({
  section,
  session,
  answers: initialAnswers,
  allSections,
}: {
  section: IntakeSectionWithQuestions;
  session: IntakeSession;
  answers: IntakeAnswerMap;
  completion: IntakeCompletion;
  brandName: string;
  allSections: IntakeSectionWithQuestions[];
}) {
  const locked = isIntakeSessionLocked(session);
  const { answers, enqueueAnswer, retryQuestion, saveStates } =
    useIntakeAutosaveQueue({
      sessionId: session.id,
      initialAnswers,
    });
  const displayedAnswers = locked ? initialAnswers : answers;
  const completion = useMemo(
    () =>
      calculateIntakeCompletion({
        sections: allSections,
        answers: displayedAnswers,
      }),
    [displayedAnswers, allSections],
  );

  const sectionQuestionIds = section.questions.map((question) => question.id);
  const sectionAnswered = sectionQuestionIds.filter((id) =>
    isIntakeAnswerComplete(displayedAnswers[id] ?? null),
  ).length;
  const sectionTotal = section.questions.length;
  const sectionPercent =
    sectionTotal > 0 ? Math.round((sectionAnswered / sectionTotal) * 100) : 0;

  const sectionIndex = allSections.findIndex((item) => item.id === section.id) + 1;

  return (
    <div
      className="min-h-svh px-4 py-6 sm:px-6 sm:py-8"
      style={{ background: "var(--bv-bg)", color: "var(--bv-ink)" }}
    >
      <div className="mx-auto max-w-[780px]">
        <div className="mb-6 flex items-center justify-between">
          <Link
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-2 text-[13px] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
            href="/dashboard/questionnaire"
            style={{
              borderColor: "var(--bv-line)",
              color: "var(--bv-ink-2)",
            }}
          >
            <ArrowLeftIcon className="size-3.5" />
            All sections
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
            Section {sectionIndex} of {allSections.length} - {sectionAnswered}/
            {sectionTotal} answered
          </span>
        </div>

        <div className="mb-9">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
            Brand Research - Phase 01
          </span>

          <div className="mt-1.5 flex items-baseline gap-2.5">
            <span className="shrink-0 text-2xl font-semibold tracking-[-0.02em] text-[var(--bv-ink-4)]">
              {sectionIndex}
            </span>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">
              {section.title}
            </h1>
          </div>

          {section.description && (
            <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
              {section.description}
            </p>
          )}

          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar color="orange" value={sectionPercent} />
            </div>
            <span className="min-w-[38px] text-right font-mono text-[11.5px] text-[var(--bv-ink-2)]">
              {sectionPercent}%
            </span>
          </div>

          {locked && (
            <div
              className="mt-4 flex items-center gap-2 rounded-[12px] border border-dashed px-3.5 py-2.5 text-[13px] text-[var(--bv-ink-2)]"
              style={{ borderColor: "var(--bv-line-2)" }}
            >
              <LockIcon className="size-3.5 shrink-0" />
              This questionnaire is submitted and locked - answers are shown for
              reference only.
            </div>
          )}

          <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {allSections.map((item) => {
              const isActive = item.id === section.id;
              const questionIds = item.questions.map((question) => question.id);
              const answered = questionIds.filter((id) =>
                isIntakeAnswerComplete(displayedAnswers[id] ?? null),
              ).length;
              const isComplete =
                answered === item.questions.length && item.questions.length > 0;

              return (
                <Link
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all",
                    isActive
                      ? "border-[var(--bv-c1-b)] bg-orange-50 font-medium text-[var(--bv-c1-b)]"
                      : "border-[var(--bv-line)] bg-white text-[var(--bv-ink-3)] hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink-2)]",
                  )}
                  href={`/dashboard/questionnaire/${item.key}`}
                  key={item.id}
                >
                  {isComplete && (
                    <CheckCircleIcon className="size-3 text-emerald-500" />
                  )}
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {section.questions.length === 0 ? (
            <div
              className="rounded-xl border p-6 text-center text-sm text-[var(--bv-ink-3)]"
              style={{
                background: "var(--bv-card)",
                borderColor: "var(--bv-line)",
              }}
            >
              No questions configured for this section yet.
            </div>
          ) : (
            section.questions.map((question, index) => (
              <div
                className="overflow-hidden rounded-xl border"
                key={question.id}
                style={{
                  background: "var(--bv-card)",
                  borderColor: "var(--bv-line)",
                }}
              >
                <div className="px-5 pt-4 pb-1">
                  <span className="font-mono text-[10px] text-[var(--bv-ink-4)]">
                    {sectionIndex}.{String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="px-5 pb-5">
                  {locked ? (
                    <div className="space-y-2">
                      <h2 className="text-[15px] font-medium leading-6">
                        {question.questionText}
                      </h2>
                      {question.helpText && (
                        <p className="text-[13px] text-[var(--bv-ink-3)]">
                          {question.helpText}
                        </p>
                      )}
                      <div
                        className="mt-1 rounded-[12px] border px-3.5 py-2.5 text-[13.5px] leading-6 whitespace-pre-wrap text-[var(--bv-ink-2)]"
                        style={{
                          background: "var(--bv-card-soft)",
                          borderColor: "var(--bv-line)",
                        }}
                      >
                        {formatAnswerValue(displayedAnswers[question.id] ?? null)}
                      </div>
                    </div>
                  ) : (
                    <QuestionRenderer
                      key={question.id}
                      onQueuedChange={enqueueAnswer}
                      onRetryQueuedSave={retryQuestion}
                      question={question}
                      saveState={saveStates[question.id]}
                      sessionId={session.id}
                      value={displayedAnswers[question.id] ?? null}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div
          className="mt-8 flex items-center justify-between border-t border-dashed pt-6"
          style={{ borderColor: "var(--bv-line-dashed)" }}
        >
          <Link
            className="inline-flex items-center gap-2 text-sm text-[var(--bv-ink-3)] transition-colors hover:text-[var(--bv-ink)]"
            href="/dashboard/questionnaire"
          >
            <ArrowLeftIcon className="size-3.5" />
            All sections
          </Link>

          {sectionIndex < allSections.length ? (
            <Link
              className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-[13px] font-medium shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
              href={`/dashboard/questionnaire/${allSections[sectionIndex].key}`}
              style={{
                borderColor: "var(--bv-line)",
                color: "var(--bv-ink-2)",
              }}
            >
              Next: {allSections[sectionIndex].title}
              <span className="text-[var(--bv-ink-4)]">-&gt;</span>
            </Link>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
              Last section - {completion.completionPercent}% overall
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
