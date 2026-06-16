"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckIcon, DownloadIcon, LockIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  isIntakeAnswerComplete,
  isIntakeSessionLocked,
} from "@/features/questionnaire/schemas";
import { QuestionRenderer } from "@/features/questionnaire/components/QuestionRenderer";
import { QuestionnaireChangeRequestDialog } from "@/features/questionnaire/components/QuestionnaireChangeRequestDialog";
import { useIntakeAutosaveQueue } from "@/features/questionnaire/components/useIntakeAutosaveQueue";
import type {
  IntakeAnswerMap,
  IntakeAnswerValue,
  IntakeCompletion,
  IntakeSectionWithQuestions,
  IntakeSession,
} from "@/features/questionnaire/types";
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
  latestSnapshotId = null,
  autoValidate = false,
}: {
  section: IntakeSectionWithQuestions;
  session: IntakeSession;
  answers: IntakeAnswerMap;
  completion: IntakeCompletion;
  brandName: string;
  allSections: IntakeSectionWithQuestions[];
  latestSnapshotId?: string | null;
  autoValidate?: boolean;
}) {
  const locked = isIntakeSessionLocked(session);
  const { answers, enqueueAnswer, retryQuestion, saveStates } =
    useIntakeAutosaveQueue({
      sessionId: session.id,
      initialAnswers,
    });
  const displayedAnswers = locked ? initialAnswers : answers;

  const sectionQuestionIds = section.questions.map((question) => question.id);
  const sectionAnswered = sectionQuestionIds.filter((id) =>
    isIntakeAnswerComplete(displayedAnswers[id] ?? null),
  ).length;
  const sectionTotal = section.questions.length;

  const sectionIndex = allSections.findIndex((item) => item.id === section.id) + 1;

  // Live progress across every section, recomputed from the autosaved answers.
  // The header bar tracks this running total — the whole journey toward Final
  // Submit — rather than just the current section, so finishing one section no
  // longer makes the bar look "100% done".
  const sectionStats = allSections.map((item) => {
    const questionIds = item.questions.map((question) => question.id);
    const answered = questionIds.filter((id) =>
      isIntakeAnswerComplete(displayedAnswers[id] ?? null),
    ).length;
    return {
      section: item,
      answered,
      total: item.questions.length,
      isComplete: item.questions.length > 0 && answered === item.questions.length,
    };
  });
  const overallTotal = sectionStats.reduce((sum, stat) => sum + stat.total, 0);
  const overallAnswered = sectionStats.reduce(
    (sum, stat) => sum + stat.answered,
    0,
  );
  const overallPercent =
    overallTotal > 0 ? Math.round((overallAnswered / overallTotal) * 100) : 0;
  const completedSections = sectionStats.filter((stat) => stat.isComplete).length;

  const [showErrors] = useState(autoValidate);

  // Arrived here from the overview's "fix this" link — highlight the gaps and
  // jump to the first unanswered question.
  useEffect(() => {
    if (!autoValidate) return;
    const firstEmpty = section.questions.find(
      (question) => !isIntakeAnswerComplete(displayedAnswers[question.id] ?? null),
    );
    if (firstEmpty) {
      document
        .getElementById(`question-card-${firstEmpty.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoValidate]);

  return (
    <div
      className="min-h-svh px-4 pb-6 pt-12 sm:px-6 sm:pb-8"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <div className="mx-auto max-w-[1057px]">
        <div className="mb-6 space-y-4">
          <Button asChild size="sm" variant="outline">
            <Link href="/brand-integrated-brain/roadmap/questionnaire">
              <ArrowLeftIcon className="size-3.5" />
              All sections
            </Link>
          </Button>
          <div className="space-y-2">
            <div className="flex min-w-0 items-center gap-4">
              <div className="min-w-0 flex-1">
                <ProgressBar color="green" value={overallPercent} />
              </div>
              <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--bv-ink-3)]">
                {overallAnswered}/{overallTotal} answered · {overallPercent}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-[0.04em] text-[var(--bv-ink-4)]">
              <span>
                Section {sectionIndex} of {allSections.length} ·{" "}
                {completedSections}/{allSections.length} sections complete
              </span>
              <span className="shrink-0">
                {sectionAnswered}/{sectionTotal} in this section
              </span>
            </div>
          </div>
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

          {locked && (
            <Alert className="mt-4" variant="success">
              <LockIcon />
              <AlertDescription>
                This questionnaire is submitted and locked - answers are shown
                for reference only.
              </AlertDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <QuestionnaireChangeRequestDialog sectionKey={section.key}>
                  <button
                    className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--bv-line)] bg-white px-3 py-1 text-[12px] font-medium text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
                    type="button"
                  >
                    Request a Change
                  </button>
                </QuestionnaireChangeRequestDialog>
                {latestSnapshotId && (
                  <a
                    className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--bv-line)] bg-white px-3 py-1 text-[12px] font-medium text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
                    download
                    href={`/api/questionnaire/${latestSnapshotId}/docx`}
                  >
                    <DownloadIcon className="size-3.5" />
                    Download answers
                  </a>
                )}
              </div>
            </Alert>
          )}

          {/* Step tracker — the full journey at a glance: which sections are
              done, where you are now, and what's still ahead. */}
          <nav aria-label="All sections" className="mt-5">
            <ol className="flex items-stretch gap-1 overflow-x-auto rounded-2xl bg-muted p-2 scrollbar-hide">
              {sectionStats.map(({ section: item, isComplete }, stepIndex) => {
                const isActive = item.id === section.id;
                const status = isComplete
                  ? "complete"
                  : isActive
                    ? "current"
                    : "upcoming";

                return (
                  <li className="flex-1" key={item.id}>
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        // Step / Trigger — base (grow to fill the frame evenly)
                        "flex h-full items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap outline-none transition-[color,background-color,box-shadow]",
                        // Keyboard focus accessibility
                        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        isActive
                          ? // Current step — active surface: white + sm shadow
                            "bg-background text-foreground shadow-sm"
                          : // Other steps — plain muted label, no background
                            "text-muted-foreground hover:text-foreground",
                      )}
                      href={
                        isComplete
                          ? `/brand-integrated-brain/roadmap/questionnaire/${item.key}`
                          : `/brand-integrated-brain/roadmap/questionnaire/${item.key}?validate=1`
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                          status === "complete" && "bg-emerald-500 text-white",
                          status === "current" && "bg-foreground text-background",
                          status === "upcoming" &&
                            "border border-[var(--bv-line-2)] text-[var(--bv-ink-4)]",
                        )}
                      >
                        {isComplete ? (
                          <CheckIcon className="size-3" strokeWidth={3} />
                        ) : (
                          stepIndex + 1
                        )}
                      </span>
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
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
                  {!locked && question.isRequired && <span>REQUIRED</span>}
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
          className="mt-8 flex flex-col gap-5 border-t border-dashed pt-6"
          style={{ borderColor: "var(--bv-line-dashed)" }}
        >
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={
                    sectionIndex > 1
                      ? `/brand-integrated-brain/roadmap/questionnaire/${allSections[sectionIndex - 2].key}`
                      : undefined
                  }
                />
              </PaginationItem>
              {allSections.map((item, index) => (
                <PaginationItem key={item.key}>
                  <PaginationLink
                    href={`/brand-integrated-brain/roadmap/questionnaire/${item.key}`}
                    isActive={index + 1 === sectionIndex}
                  >
                    {index + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationLast
                  href={
                    sectionIndex < allSections.length
                      ? `/brand-integrated-brain/roadmap/questionnaire/${allSections[allSections.length - 1].key}`
                      : undefined
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <div className="flex items-center justify-between">
            <Button asChild className="text-[var(--bv-ink-3)] hover:text-[var(--bv-ink)]" variant="ghost">
              <Link href="/brand-integrated-brain/roadmap/questionnaire">
                <ArrowLeftIcon className="size-3.5" />
                All sections
              </Link>
            </Button>

            {sectionIndex < allSections.length ? (
              <Button asChild className="group" variant="outline">
                <Link
                  href={`/brand-integrated-brain/roadmap/questionnaire/${allSections[sectionIndex].key}?validate=1`}
                >
                  Next: {allSections[sectionIndex].title}
                  <span className="text-[var(--bv-ink-4)] transition-transform group-hover:translate-x-0.5">
                    -&gt;
                  </span>
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/brand-integrated-brain/roadmap/questionnaire">Review &amp; submit</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
