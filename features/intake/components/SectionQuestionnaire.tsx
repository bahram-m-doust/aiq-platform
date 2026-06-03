"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

  const router = useRouter();
  const [showErrors, setShowErrors] = useState(false);

  function handleFinish() {
    const emptyQuestions = section.questions.filter(
      (question) => !isIntakeAnswerComplete(displayedAnswers[question.id] ?? null),
    );

    // Unanswered questions in this section — flag them in place instead of
    // navigating away.
    if (emptyQuestions.length > 0) {
      setShowErrors(true);
      document
        .getElementById(`question-card-${emptyQuestions[0].id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // This section is complete — head to the overview to finish the rest.
    router.push("/dashboard/questionnaire");
  }

  return (
    <div
      className="min-h-svh px-4 py-6 sm:px-6 sm:py-8"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <div className="mx-auto max-w-[1057px]">
        <div className="mb-6 flex items-center justify-between">
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-[var(--bv-line)] bg-white px-3.5 py-2 text-[13px] text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:bg-[var(--bv-card-soft)] hover:text-[var(--bv-ink)]"
            href="/dashboard/questionnaire"
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

          <div className="mt-5">
            <div className="mb-1.5 text-right font-mono text-[11.5px] text-[var(--bv-ink-2)]">
              {sectionPercent}%
            </div>
            <ProgressBar color="green" value={sectionPercent} />
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

          <div className="mt-5">
            <div className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-muted p-3 scrollbar-hide">
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
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      // Tabs / Trigger — base (grow to fill the frame evenly)
                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap outline-none transition-[color,background-color,box-shadow]",
                      // Keyboard focus accessibility
                      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      isActive
                        ? // Current page — active surface: white + sm shadow
                          "bg-background text-foreground shadow-sm"
                        : // Other tabs — plain muted label, no background
                          "text-muted-foreground hover:text-foreground",
                    )}
                    href={`/dashboard/questionnaire/${item.key}`}
                    key={item.id}
                  >
                    {isComplete && (
                      <CheckCircleIcon className="size-3.5 text-emerald-500" />
                    )}
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {section.questions.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-xs">
              No questions configured for this section yet.
            </div>
          ) : (
            section.questions.map((question, index) => (
              <div
                className="rounded-lg border border-border bg-card px-6 py-5 shadow-xs"
                id={`question-card-${question.id}`}
                key={question.id}
              >
                <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                  <span>
                    {sectionIndex}.{String(index + 1).padStart(2, "0")}
                  </span>
                  {question.isRequired && <span>REQUIRED</span>}
                </div>
                <div className="mt-3">
                  {locked ? (
                    <div className="space-y-2">
                      <h2 className="text-sm font-medium leading-snug text-foreground">
                        {question.questionText}
                      </h2>
                      {question.helpText && (
                        <p className="text-sm text-muted-foreground">
                          {question.helpText}
                        </p>
                      )}
                      <div className="mt-1 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm leading-6 whitespace-pre-wrap text-foreground shadow-xs">
                        {formatAnswerValue(displayedAnswers[question.id] ?? null)}
                      </div>
                    </div>
                  ) : (
                    <QuestionRenderer
                      key={question.id}
                      onQueuedChange={enqueueAnswer}
                      onRetryQueuedSave={retryQuestion}
                      question={question}
                      requiredError={showErrors}
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
              className="group inline-flex items-center gap-2 rounded-full border border-[var(--bv-line)] bg-white px-4 py-2 text-[13px] font-medium text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:bg-[var(--bv-card-soft)] hover:text-[var(--bv-ink)] hover:shadow-md"
              href={`/dashboard/questionnaire/${allSections[sectionIndex].key}`}
            >
              Next: {allSections[sectionIndex].title}
              <span className="text-[var(--bv-ink-4)] transition-transform group-hover:translate-x-0.5">
                -&gt;
              </span>
            </Link>
          ) : completion.completionPercent === 100 ? (
            <Link
              className="inline-flex items-center rounded-full border border-[var(--bv-line)] bg-white px-4 py-2 text-[13px] font-medium text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:bg-[var(--bv-card-soft)] hover:text-[var(--bv-ink)] hover:shadow-md"
              href="/dashboard/questionnaire"
            >
              Review &amp; submit
            </Link>
          ) : (
            <button
              className="inline-flex items-center rounded-full border border-[var(--bv-line)] bg-white px-4 py-2 text-[13px] font-medium text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:bg-[var(--bv-card-soft)] hover:text-[var(--bv-ink)] hover:shadow-md"
              onClick={handleFinish}
              type="button"
            >
              Finish questionnaire
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
