import Link from "next/link";
import {
  ArrowRightIcon,
  DownloadIcon,
  LockIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FinalSubmitReadiness } from "@/features/questionnaire/components/FinalSubmitReadiness";
import { ProgressSidePanel } from "@/features/questionnaire/components/ProgressSidePanel";
import { QuestionnaireProgressSummary } from "@/features/questionnaire/components/QuestionnaireProgressSummary";
import { QuestionnaireChangeRequestDialog } from "@/features/questionnaire/components/QuestionnaireChangeRequestDialog";
import {
  canApproveIntakeRole,
  isIntakeAnswerComplete,
  isIntakeSessionLocked,
} from "@/features/questionnaire/schemas";
import type { IntakePageData } from "@/features/questionnaire/types";
import { questionnaireSectionPath } from "@/lib/routes";

type SectionState = "done" | "in-progress" | "not-started";

function sectionState({
  completedQuestions,
  completionPercent,
  draftAnsweredQuestions,
  totalQuestions,
}: {
  completedQuestions: number;
  completionPercent: number;
  draftAnsweredQuestions: number;
  totalQuestions: number;
}): SectionState {
  if (totalQuestions === 0) return "not-started";
  if (completionPercent === 100) return "done";
  if (completedQuestions > 0 || draftAnsweredQuestions > 0) {
    return "in-progress";
  }
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
  const completionPercent = Math.max(
    0,
    Math.min(100, completion.completionPercent),
  );
  const questionnaireComplete =
    completion.totalQuestions > 0 &&
    completionPercent === 100 &&
    completion.answeredQuestions === completion.totalQuestions;
  const pageDescription = locked
    ? "Your brand questionnaire has been approved and locked. These responses are now being used to develop your brand roadmap. You can still review or download your answers at any time."
    : questionnaireComplete
    ? "Your brand questionnaire is complete. Review each section carefully, then approve your responses to move your brand roadmap into development."
    : "Six short sections capture the raw signal behind your brand — voice, audience, market and ambition. Pick any section to start; your answers save automatically as you go.";

  // Per-section summary for the side panel
  const sectionSummaries = sections.map((section) => {
    const progress = progressByKey.get(section.key);
    return {
      id: section.id,
      key: section.key,
      title: section.title,
      totalQuestions: progress?.totalQuestions ?? section.questions.length,
      answeredQuestions: section.questions.filter((q) =>
        isIntakeAnswerComplete(answers[q.id] ?? null),
      ).length,
      completedQuestions: progress?.answeredQuestions ?? 0,
    };
  });

  return (
    <div
      className="min-h-svh px-4 pb-6 pt-12 sm:px-6 sm:pb-8"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <div className="mx-auto max-w-[1057px]">
        <div>
          {/* Summary */}
          <QuestionnaireProgressSummary
            answeredQuestions={completion.answeredQuestions}
            className="mb-6"
            completionPercent={completionPercent}
            totalQuestions={completion.totalQuestions}
          />

          {/* Page header */}
          <div className="mb-9">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
              Brand Research · Phase 01
            </span>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]">
              Questionnaires
            </h1>
            <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
              {pageDescription}
            </p>

            {locked && (
              <Alert className="mt-4" variant="success">
                <LockIcon />
                <AlertTitle>Questionnaire approved and locked</AlertTitle>
                <AlertDescription>
                  Your responses are now finalized and being used to develop
                  your brand roadmap. Sections are read-only, but you can open
                  any section to review your answers.
                </AlertDescription>
                <div className="col-start-2 mt-2 flex flex-wrap items-center gap-2">
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
                      Download Responses
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
              const draftAnswered = section.questions.filter((q) =>
                isIntakeAnswerComplete(answers[q.id] ?? null),
              ).length;
              const state = sectionState({
                completedQuestions: answered,
                completionPercent: progress?.completionPercent ?? 0,
                draftAnsweredQuestions: draftAnswered,
                totalQuestions: total,
              });

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

          {/* Approve control — always present, disabled until complete. */}
          {!locked && (
            <div className="mt-8">
              <FinalSubmitReadiness
                canApprove={canApprove}
                completion={completion}
                sessionId={session.id}
              />
            </div>
          )}
        </div>

        {/* Collapsible side panel */}
        {!locked && (
          <ProgressSidePanel
            completionPercent={completion.completionPercent}
            sections={sectionSummaries}
            sessionId={session.id}
            showReview={showSubmitReview}
            showReadyReviewAction={false}
            totalCompleted={completion.answeredQuestions}
            totalQuestions={completion.totalQuestions}
          />
        )}
      </div>
    </div>
  );
}
