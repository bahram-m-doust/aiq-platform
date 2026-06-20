import Link from "next/link";
import {
  ArrowRightIcon,
  DownloadIcon,
  LockIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { FinalSubmitReadiness } from "@/features/questionnaire/components/FinalSubmitReadiness";
import { QuestionnaireChangeRequestDialog } from "@/features/questionnaire/components/QuestionnaireChangeRequestDialog";
import {
  canApproveIntakeRole,
  isIntakeAnswerComplete,
  isIntakeSessionLocked,
} from "@/features/questionnaire/schemas";
import type {
  IntakePageData,
  IntakeSectionProgress,
} from "@/features/questionnaire/types";
import { questionnaireSectionPath } from "@/lib/routes";

type SectionState = "done" | "in-progress" | "not-started";

function sectionState(progress: IntakeSectionProgress | undefined): SectionState {
  if (!progress || progress.totalQuestions === 0) return "not-started";
  if (progress.completionPercent === 100) return "done";
  if (progress.answeredQuestions > 0) return "in-progress";
  return "not-started";
}

const STATE_STYLE: Record<SectionState, React.CSSProperties> = {
  done: {
    color: "#157a52",
    borderColor: "rgba(43,199,138,0.28)",
    background: "rgba(43,199,138,0.12)",
  },
  "in-progress": {
    color: "#1a5bb5",
    borderColor: "rgba(42,124,255,0.28)",
    background: "rgba(42,124,255,0.12)",
  },
  "not-started": {
    color: "var(--bv-ink-3)",
    borderColor: "var(--bv-line-2)",
    background: "#fff",
  },
};

const STATE_LABEL: Record<SectionState, string> = {
  done: "Completed",
  "in-progress": "In progress",
  "not-started": "Not started",
};

export function QuestionnaireLanding({
  data,
  showSubmitReview = false,
}: {
  data: IntakePageData;
  showSubmitReview?: boolean;
}) {
  const { sections, completion, session, access, answers } = data;
  const locked = isIntakeSessionLocked(session);
  const canApprove = canApproveIntakeRole(access.membershipRole);
  const progressByKey = new Map(
    completion.sections.map((s) => [s.sectionKey, s]),
  );
  // "Unanswered" for the warning box = a question the user hasn't explicitly
  // "Save & mark done"-ed yet (an autosaved draft still counts as unanswered).
  // Before the marked_done_at migration lands, markedDoneQuestionIds is null and
  // this falls back to the value-based definition. The section cards above keep
  // their own value-based counts, unchanged.
  const markedDoneSet = data.markedDoneQuestionIds
    ? new Set(data.markedDoneQuestionIds)
    : null;
  const incompleteSections = sections
    .map((section) => {
      const remaining = section.questions.filter((question) => {
        const hasValue = isIntakeAnswerComplete(answers[question.id] ?? null);
        return markedDoneSet
          ? !(hasValue && markedDoneSet.has(question.id))
          : !hasValue;
      }).length;
      return { section, remaining };
    })
    .filter((entry) => entry.remaining > 0);
  const totalRemaining = incompleteSections.reduce(
    (sum, entry) => sum + entry.remaining,
    0,
  );
  const overallColor = "green" as const;

  return (
    <div
      className="min-h-svh px-4 pb-6 pt-12 sm:px-6 sm:pb-8"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <div className="mx-auto max-w-[1057px]">
        {/* Summary (navigation handled by the global breadcrumb) */}
        <div className="mb-6 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <ProgressBar color={overallColor} value={completion.completionPercent} />
          </div>
          <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--bv-ink-3)]">
            {completion.answeredQuestions}/{completion.totalQuestions} answered ·{" "}
            {completion.completionPercent}%
          </span>
        </div>

        {/* Page header */}
        <div className="mb-9">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
            Brand Research · Phase 01
          </span>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]">
            Questionnaires
          </h1>
          <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
            Six short sections capture the raw signal behind your brand —
            voice, audience, market and ambition. Pick any section to start;
            your answers save automatically as you go.
          </p>

          {locked && (
            <Alert className="mt-4" variant="success">
              <LockIcon />
              <AlertDescription>
                This questionnaire has been submitted and locked. Sections are
                read-only — open one to review your answers.
              </AlertDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {sections[0] ? (
                  <QuestionnaireChangeRequestDialog
                    sectionKey={sections[0].key}
                    triggerClassName="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--bv-line)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
                  />
                ) : null}
                {data.latestSnapshotId && (
                  <a
                    className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--bv-line)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
                    download
                    href={`/api/questionnaire/${data.latestSnapshotId}/docx`}
                  >
                    <DownloadIcon className="size-3.5" />
                    Download answers
                  </a>
                )}
              </div>
            </Alert>
          )}
        </div>

        {/* Section list */}
        <div className="mb-2 flex items-baseline justify-between px-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--bv-ink-3)]">
            Sections
          </span>
          <span className="font-mono text-[10px] text-[var(--bv-ink-4)]">
            {sections.length} total
          </span>
        </div>

        <div className="space-y-4">
          {sections.map((section, index) => {
            const progress = progressByKey.get(section.key);
            const total = progress?.totalQuestions ?? section.questions.length;
            const answered = progress?.answeredQuestions ?? 0;
            const state = sectionState(progress);

            return (
              <Link
                className="group flex items-center gap-3 rounded-xl border bg-[var(--bv-card)] px-5 py-4 transition-all duration-200 hover:border-[var(--bv-line-2)] hover:shadow-sm"
                href={questionnaireSectionPath(section.key)}
                key={section.id}
                style={{ borderColor: "var(--bv-line)" }}
              >
                <span className="shrink-0 text-[15px] font-semibold tracking-[-0.005em] text-[var(--bv-ink-4)]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-semibold tracking-[-0.005em]">
                    {section.title}
                  </h2>
                  {section.description && (
                    <p className="truncate text-[12.5px] text-[var(--bv-ink-3)]">
                      {section.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[10.5px] text-[var(--bv-ink-4)]">
                  {answered}/{total}
                </span>
                <Badge variant="outline" style={STATE_STYLE[state]}>
                  {STATE_LABEL[state]}
                </Badge>
                <ArrowRightIcon className="size-4 shrink-0 text-[var(--bv-ink-4)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--bv-ink-2)]" />
              </Link>
            );
          })}
        </div>

        {/* Submit (only on the review step). */}
        {!locked && showSubmitReview && (
          <div className="mt-8">
            <FinalSubmitReadiness
              canApprove={canApprove}
              completion={completion}
              sessionId={session.id}
            />
          </div>
        )}

        {/* Unanswered — always visible. Lists every question not yet
            "Save & mark done"-ed; an autosaved draft still counts as unanswered. */}
        {!locked && incompleteSections.length > 0 && (
          <div className="mt-8">
            <Alert variant="warning">
              <TriangleAlertIcon />
              <AlertTitle>
                {totalRemaining}{" "}
                {totalRemaining === 1 ? "question" : "questions"} not marked done
                yet.
              </AlertTitle>
              <AlertDescription>
                <ul className="space-y-1">
                  {incompleteSections.map(({ section, remaining }) => (
                    <li key={section.id}>
                      <Link
                        className="inline-flex items-center gap-2 underline-offset-2 transition-colors hover:underline"
                        href={`${questionnaireSectionPath(section.key)}?validate=1`}
                      >
                        <span className="font-medium">{section.title}</span>
                        <span className="opacity-80">
                          — {remaining} unanswered
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}
