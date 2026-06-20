"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRightIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProgressBar } from "@/components/ui/progress-bar";
import { UnansweredReveal } from "@/features/questionnaire/components/UnansweredReveal";
import { questionnaireSectionPath } from "@/lib/routes";

type SectionSummary = {
  id: string;
  key: string;
  title: string;
  totalQuestions: number;
  answeredQuestions: number;
  completedQuestions: number;
};

export function ProgressSidePanel({
  totalQuestions,
  totalAnswered,
  totalCompleted,
  completionPercent,
  sections,
  sessionId,
  showReview,
}: {
  totalQuestions: number;
  totalAnswered: number;
  totalCompleted: number;
  completionPercent: number;
  sections: SectionSummary[];
  sessionId: string;
  showReview: boolean;
}) {
  const [open, setOpen] = useState(true);

  const incompleteSections = sections.filter(
    (s) => s.completedQuestions < s.totalQuestions,
  );
  const totalRemaining = totalQuestions - totalCompleted;

  return (
    <>
      {!open && (
        <button
          className="fixed right-4 top-20 z-40 flex size-9 items-center justify-center rounded-lg border border-[var(--bv-line)] bg-white shadow-sm transition-colors hover:bg-gray-50"
          onClick={() => setOpen(true)}
          type="button"
          aria-label="Open progress panel"
        >
          <PanelRightOpenIcon className="size-4 text-[var(--bv-ink-3)]" />
        </button>
      )}

      <aside
        className={
          open
            ? "sticky top-4 hidden h-fit w-[280px] shrink-0 flex-col gap-5 xl:flex"
            : "hidden"
        }
      >
        <div className="rounded-xl border border-[var(--bv-line)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--bv-line)] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--bv-ink-3)]">
              Progress
            </span>
            <button
              className="flex size-6 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
              onClick={() => setOpen(false)}
              type="button"
              aria-label="Close progress panel"
            >
              <PanelRightCloseIcon className="size-3.5 text-[var(--bv-ink-3)]" />
            </button>
          </div>

          <div className="flex flex-col gap-4 px-4 py-4">
            <div>
              <ProgressBar color="green" value={completionPercent} />
              <span className="mt-1.5 block font-mono text-[10px] text-[var(--bv-ink-4)]">
                {completionPercent}%
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[var(--bv-ink-3)]">
                  Answered questions
                </span>
                <span className="font-mono text-xs font-semibold">
                  {totalAnswered}/{totalQuestions}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[var(--bv-ink-3)]">
                  Completed questions
                </span>
                <span className="font-mono text-xs font-semibold text-emerald-600">
                  {totalCompleted}
                </span>
              </div>
            </div>

            <div className="border-t border-[var(--bv-line)] pt-3">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-[var(--bv-ink-4)]">
                Sections
              </span>
              <ul className="flex flex-col gap-1.5">
                {sections.map((section) => (
                  <li key={section.id}>
                    <Link
                      className="group flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-gray-50"
                      href={questionnaireSectionPath(section.key)}
                    >
                      <span className="truncate text-[var(--bv-ink-2)] group-hover:text-[var(--bv-ink)]">
                        {section.title}
                      </span>
                      <span className="ml-2 shrink-0 font-mono text-[10px] text-[var(--bv-ink-4)]">
                        {section.completedQuestions}/{section.totalQuestions}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {totalRemaining > 0 && (
          <UnansweredReveal reviewReached={showReview} sessionId={sessionId}>
            <Alert variant="warning">
              <TriangleAlertIcon />
              <AlertTitle>
                {totalRemaining} uncompleted{" "}
                {totalRemaining === 1 ? "question" : "questions"}.
              </AlertTitle>
              <AlertDescription>
                <ul className="space-y-1">
                  {incompleteSections.map((section) => {
                    const remaining =
                      section.totalQuestions - section.completedQuestions;
                    return (
                      <li key={section.id}>
                        <Link
                          className="inline-flex items-center gap-2 underline-offset-2 transition-colors hover:underline"
                          href={`${questionnaireSectionPath(section.key)}?validate=1`}
                        >
                          <span className="font-medium">{section.title}</span>
                          <span className="opacity-80">
                            — {remaining} uncompleted
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </AlertDescription>
            </Alert>
          </UnansweredReveal>
        )}
      </aside>
    </>
  );
}
