"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  calculateIntakeCompletion,
  isIntakeAnswerComplete,
} from "@/features/intake/schemas";
import { QuestionRenderer } from "@/features/intake/components/QuestionRenderer";
import type {
  IntakeAnswerMap,
  IntakeAnswerValue,
  IntakeCompletion,
  IntakeSectionWithQuestions,
  IntakeSession,
} from "@/features/intake/types";
import { cn } from "@/lib/utils";

export function SectionQuestionnaire({
  section,
  session,
  answers: initialAnswers,
  completion: initialCompletion,
  brandName,
  allSections,
}: {
  section: IntakeSectionWithQuestions;
  session: IntakeSession;
  answers: IntakeAnswerMap;
  completion: IntakeCompletion;
  brandName: string;
  allSections: IntakeSectionWithQuestions[];
}) {
  const [answers, setAnswers] = useState<IntakeAnswerMap>(initialAnswers);
  const completion = useMemo(
    () => calculateIntakeCompletion({ sections: allSections, answers }),
    [answers, allSections],
  );

  const sectionQuestionIds = section.questions.map((q) => q.id);
  const sectionAnswered = sectionQuestionIds.filter((id) =>
    isIntakeAnswerComplete(answers[id] ?? null),
  ).length;
  const sectionTotal = section.questions.length;
  const sectionPercent =
    sectionTotal > 0 ? Math.round((sectionAnswered / sectionTotal) * 100) : 0;

  const sectionIndex =
    allSections.findIndex((s) => s.id === section.id) + 1;

  function handleSaved(questionId: string, value: IntakeAnswerValue) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  return (
    <div
      className="min-h-svh px-6 py-8"
      style={{ background: "var(--bv-bg)", color: "var(--bv-ink)" }}
    >
      <div className="mx-auto max-w-[780px]">
        {/* Back + breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-2 text-[13px] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
            href="/dashboard"
            style={{
              borderColor: "var(--bv-line)",
              color: "var(--bv-ink-2)",
            }}
          >
            <ArrowLeftIcon className="size-3.5" />
            Dashboard
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
            Section {sectionIndex} of {allSections.length} · {sectionAnswered}/{sectionTotal} answered
          </span>
        </div>

        {/* Section header */}
        <div
          className="mb-6 overflow-hidden rounded-[20px] border p-6"
          style={{
            background: "var(--bv-card)",
            borderColor: "var(--bv-line)",
            boxShadow: "var(--bv-shadow-card)",
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="grid size-9 place-items-center rounded-lg text-sm font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(150deg, var(--bv-c1-a), var(--bv-c1-b))",
                  boxShadow:
                    "0 3px 10px -3px rgba(15,15,20,0.25), inset 0 1px 0 rgba(255,255,255,0.35)",
                }}
              >
                {sectionIndex}
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-[-0.01em]">
                  {section.title}
                </h1>
                {section.description && (
                  <p className="mt-0.5 text-sm text-[var(--bv-ink-3)]">
                    {section.description}
                  </p>
                )}
              </div>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--bv-ink-3)]">
              <span
                className="inline-block size-[5px] rounded-full"
                style={{
                  background:
                    sectionPercent === 100
                      ? "#2bc78a"
                      : "var(--bv-c1-b)",
                }}
              />
              Phase 01
            </span>
          </div>

          <div className="mb-3 flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar color="orange" value={sectionPercent} />
            </div>
            <span className="min-w-[38px] text-right font-mono text-[11.5px] text-[var(--bv-ink-2)]">
              {sectionPercent}%
            </span>
          </div>

          {/* Section nav pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {allSections.map((s, i) => {
              const isActive = s.id === section.id;
              const sIds = s.questions.map((q) => q.id);
              const sDone = sIds.filter((id) =>
                isIntakeAnswerComplete(answers[id] ?? null),
              ).length;
              const sComplete = sDone === s.questions.length && s.questions.length > 0;

              return (
                <Link
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all",
                    isActive
                      ? "border-[var(--bv-c1-b)] bg-orange-50 font-medium text-[var(--bv-c1-b)]"
                      : "border-[var(--bv-line)] bg-white text-[var(--bv-ink-3)] hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink-2)]",
                  )}
                  href={`/dashboard/questionnaire/${s.key}`}
                  key={s.id}
                >
                  {sComplete && (
                    <CheckCircleIcon className="size-3 text-emerald-500" />
                  )}
                  {s.title}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {section.questions.length === 0 ? (
            <div
              className="rounded-[16px] border p-6 text-center text-sm text-[var(--bv-ink-3)]"
              style={{
                background: "var(--bv-card)",
                borderColor: "var(--bv-line)",
              }}
            >
              No questions configured for this section yet.
            </div>
          ) : (
            section.questions.map((question, i) => (
              <div
                className="overflow-hidden rounded-[16px] border transition-shadow hover:shadow-md"
                key={question.id}
                style={{
                  background: "var(--bv-card)",
                  borderColor: "var(--bv-line)",
                  boxShadow: "var(--bv-shadow-card)",
                }}
              >
                <div className="px-5 pt-4 pb-1">
                  <span className="font-mono text-[10px] text-[var(--bv-ink-4)]">
                    {sectionIndex}.{String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="px-5 pb-5">
                  <QuestionRenderer
                    key={question.id}
                    onSaved={handleSaved}
                    question={question}
                    sessionId={session.id}
                    value={answers[question.id] ?? null}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer nav */}
        <div
          className="mt-8 flex items-center justify-between border-t border-dashed pt-6"
          style={{ borderColor: "var(--bv-line-dashed)" }}
        >
          <Link
            className="inline-flex items-center gap-2 text-sm text-[var(--bv-ink-3)] transition-colors hover:text-[var(--bv-ink)]"
            href="/dashboard"
          >
            <ArrowLeftIcon className="size-3.5" />
            Dashboard
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
              <span className="text-[var(--bv-ink-4)]">→</span>
            </Link>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
              Last section · {completion.completionPercent}% overall
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
