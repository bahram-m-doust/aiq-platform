import Link from "next/link";
import { ArrowRightIcon, DownloadIcon, LockIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { FinalSubmitReadiness } from "@/features/intake/components/FinalSubmitReadiness";
import {
  canApproveIntakeRole,
  isIntakeSessionLocked,
} from "@/features/intake/schemas";
import type {
  IntakePageData,
  IntakeSectionProgress,
} from "@/features/intake/types";

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

export function QuestionnaireLanding({ data }: { data: IntakePageData }) {
  const { sections, completion, session, access } = data;
  const locked = isIntakeSessionLocked(session);
  const canApprove = canApproveIntakeRole(access.membershipRole);
  const progressByKey = new Map(
    completion.sections.map((s) => [s.sectionKey, s]),
  );
  const incompleteSections = sections
    .map((section) => {
      const sectionProgress = progressByKey.get(section.key);
      const total = sectionProgress?.totalQuestions ?? section.questions.length;
      const answered = sectionProgress?.answeredQuestions ?? 0;
      return { section, remaining: total - answered };
    })
    .filter((entry) => entry.remaining > 0);
  const totalRemaining = incompleteSections.reduce(
    (sum, entry) => sum + entry.remaining,
    0,
  );
  const overallColor = "green" as const;

  return (
    <div
      className="min-h-svh px-4 py-6 sm:px-6 sm:py-8"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <div className="mx-auto max-w-[1057px]">
        {/* Summary (navigation handled by the global breadcrumb) */}
        <div className="mb-6 flex items-center justify-end">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
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

          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar color={overallColor} value={completion.completionPercent} />
            </div>
            <span className="min-w-[38px] text-right font-mono text-[11.5px] text-[var(--bv-ink-2)]">
              {completion.completionPercent}%
            </span>
          </div>

          {locked && (
            <Alert className="mt-4" variant="success">
              <LockIcon />
              <AlertDescription>
                This questionnaire has been submitted and locked. Sections are
                read-only — open one to review your answers.
              </AlertDescription>
              {data.latestSnapshotId && (
                <a
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--bv-line)] bg-white px-3 py-1 text-[12px] font-medium text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
                  download
                  href={`/api/intake/${data.latestSnapshotId}/docx`}
                >
                  <DownloadIcon className="size-3.5" />
                  Download answers (Word)
                </a>
              )}
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
            const percent = progress?.completionPercent ?? 0;
            const state = sectionState(progress);
            const barColor: "green-soft" | "muted" =
              state === "not-started" ? "muted" : "green-soft";

            return (
              <Link
                className="group block overflow-hidden rounded-xl border bg-[var(--bv-card)] p-5 transition-all duration-200 hover:border-[var(--bv-line-2)] hover:shadow-sm"
                href={
                  state === "done"
                    ? `/dashboard/questionnaire/${section.key}`
                    : `/dashboard/questionnaire/${section.key}?validate=1`
                }
                key={section.id}
                style={{ borderColor: "var(--bv-line)" }}
              >
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-baseline gap-2.5">
                        <span className="shrink-0 text-[15px] font-semibold tracking-[-0.005em] text-[var(--bv-ink-4)]">
                          {index + 1}
                        </span>
                        <h2 className="truncate text-[15px] font-semibold tracking-[-0.005em]">
                          {section.title}
                        </h2>
                      </div>
                      <Badge variant="outline" style={STATE_STYLE[state]}>
                        {STATE_LABEL[state]}
                      </Badge>
                    </div>

                    {section.description && (
                      <p className="mt-1 line-clamp-1 text-[13px] text-[var(--bv-ink-3)]">
                        {section.description}
                      </p>
                    )}

                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex-1">
                        <ProgressBar color={barColor} value={percent} />
                      </div>
                      <span className="min-w-[44px] text-right font-mono text-[10.5px] text-[var(--bv-ink-3)]">
                        {answered}/{total}
                      </span>
                    </div>
                  </div>

                  <ArrowRightIcon className="size-4 shrink-0 text-[var(--bv-ink-4)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--bv-ink-2)]" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Submit */}
        {!locked && (
          <div className="mt-8">
            <FinalSubmitReadiness
              canApprove={canApprove}
              completion={completion}
              sessionId={session.id}
            />
            {completion.completionPercent < 100 && incompleteSections.length > 0 && (
              <div
                className="mt-4 rounded-[12px] border px-4 py-3.5"
                style={{ borderColor: "var(--bv-line-2)", background: "var(--bv-card)" }}
              >
                <p className="text-[13px] font-medium text-[var(--bv-ink)]">
                  {totalRemaining}{" "}
                  {totalRemaining === 1 ? "question" : "questions"} still need an
                  answer before you can submit.
                </p>
                <ul className="mt-2 space-y-1">
                  {incompleteSections.map(({ section, remaining }) => (
                    <li key={section.id}>
                      <Link
                        className="inline-flex items-center gap-2 text-[13px] text-[var(--bv-ink-2)] underline-offset-2 transition-colors hover:text-[var(--bv-ink)] hover:underline"
                        href={`/dashboard/questionnaire/${section.key}?validate=1`}
                      >
                        <span className="font-medium">{section.title}</span>
                        <span className="text-[var(--bv-ink-3)]">
                          — {remaining} unanswered
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
