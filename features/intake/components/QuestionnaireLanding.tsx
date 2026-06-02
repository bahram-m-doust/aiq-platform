import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  LockIcon,
} from "lucide-react";

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
  const overallColor: "green" | "orange" =
    completion.completionPercent === 100 ? "green" : "orange";

  return (
    <div
      className="min-h-svh px-4 py-6 sm:px-6 sm:py-8"
      style={{ background: "var(--bv-bg)", color: "var(--bv-ink)" }}
    >
      <div className="mx-auto max-w-[780px]">
        {/* Back + summary */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-2 text-[13px] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
            href="/dashboard"
            style={{ borderColor: "var(--bv-line)", color: "var(--bv-ink-2)" }}
          >
            <ArrowLeftIcon className="size-3.5" />
            Dashboard
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
            {completion.answeredQuestions}/{completion.totalQuestions} answered ·{" "}
            {completion.completionPercent}%
          </span>
        </div>

        {/* Header card */}
        <div
          className="mb-6 overflow-hidden rounded-[20px] border p-6"
          style={{
            background: "var(--bv-card)",
            borderColor: "var(--bv-line)",
            boxShadow: "var(--bv-shadow-card)",
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold text-white"
              style={{
                background:
                  "linear-gradient(150deg, var(--bv-c1-a), var(--bv-c1-b))",
                boxShadow:
                  "0 3px 10px -3px rgba(15,15,20,0.25), inset 0 1px 0 rgba(255,255,255,0.35)",
              }}
            >
              <CheckCircleIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--bv-ink-3)]">
                Brand Research · Phase 01
              </span>
              <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.01em]">
                Questionnaires
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-[var(--bv-ink-3)]">
                Six short sections capture the raw signal behind your brand —
                voice, audience, market and ambition. Pick any section to start;
                your answers save automatically as you go.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar color={overallColor} value={completion.completionPercent} />
            </div>
            <span className="min-w-[38px] text-right font-mono text-[11.5px] text-[var(--bv-ink-2)]">
              {completion.completionPercent}%
            </span>
          </div>

          {locked && (
            <div
              className="mt-4 flex items-center gap-2 rounded-[12px] border border-dashed px-3.5 py-2.5 text-[13px] text-[var(--bv-ink-2)]"
              style={{ borderColor: "var(--bv-line-2)" }}
            >
              <LockIcon className="size-3.5 shrink-0" />
              This questionnaire has been submitted and locked. Sections are
              read-only — open one to review your answers.
            </div>
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

        <div className="space-y-3">
          {sections.map((section, index) => {
            const progress = progressByKey.get(section.key);
            const total = progress?.totalQuestions ?? section.questions.length;
            const answered = progress?.answeredQuestions ?? 0;
            const percent = progress?.completionPercent ?? 0;
            const state = sectionState(progress);
            const barColor: "green" | "orange" | "muted" =
              state === "done" ? "green" : state === "in-progress" ? "orange" : "muted";

            return (
              <Link
                className="group block overflow-hidden rounded-[16px] border bg-[var(--bv-card)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--bv-line-2)] hover:shadow-md"
                href={`/dashboard/questionnaire/${section.key}`}
                key={section.id}
                style={{
                  borderColor: "var(--bv-line)",
                  boxShadow: "var(--bv-shadow-card)",
                }}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold text-white"
                    style={{
                      background:
                        state === "done"
                          ? "linear-gradient(150deg, var(--bv-c3-a), var(--bv-c3-b))"
                          : "linear-gradient(150deg, var(--bv-c1-a), var(--bv-c1-b))",
                      boxShadow:
                        "0 3px 10px -3px rgba(15,15,20,0.25), inset 0 1px 0 rgba(255,255,255,0.35)",
                    }}
                  >
                    {state === "done" ? (
                      <CheckCircleIcon className="size-5" />
                    ) : (
                      index + 1
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="truncate text-[15px] font-semibold tracking-[-0.005em]">
                        {section.title}
                      </h2>
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider whitespace-nowrap"
                        style={STATE_STYLE[state]}
                      >
                        <span className="inline-block size-[5px] rounded-full bg-current" />
                        {STATE_LABEL[state]}
                      </span>
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
            {completion.completionPercent < 100 && (
              <p className="mt-3 text-center text-[12px] text-[var(--bv-ink-4)]">
                Complete all {sections.length} sections to submit your
                questionnaire.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
