"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CircleCheckIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react";


import { ProgressBar } from "@/components/ui/progress-bar";
import { ReviewReadyReveal } from "@/features/questionnaire/components/ReviewReadyReveal";
import { UnansweredReveal } from "@/features/questionnaire/components/UnansweredReveal";
import { ROUTES, questionnaireSectionPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

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
      {/* Collapsed-rail toggle — only relevant on xl, where the panel docks as
          a fixed rail. Below xl the panel lives inline, so there's nothing to
          expand. */}
      {!open && (
        <button
          className="fixed right-4 top-20 z-40 hidden size-9 items-center justify-center rounded-lg border border-[var(--bv-line)] bg-white shadow-sm transition-colors hover:bg-gray-50 xl:flex"
          onClick={() => setOpen(true)}
          type="button"
          aria-label="Open progress panel"
        >
          <PanelRightOpenIcon className="size-4 text-[var(--bv-ink-3)]" />
        </button>
      )}

      <aside
        className={cn(
          // Mobile / tablet: an inline card in the page flow so progress, the
          // warning and the Review & submit button are never lost off-canvas.
          "mx-auto mt-8 flex w-full max-w-[480px] flex-col gap-5 rounded-[10px] border border-border bg-card px-4 py-4 shadow-xs",
          // xl: dock as a fixed, collapsible right rail.
          "xl:fixed xl:right-4 xl:top-[84px] xl:z-30 xl:mx-0 xl:mt-0 xl:max-h-[calc(100vh-100px)] xl:w-[280px] xl:max-w-none xl:overflow-y-auto",
          open ? "xl:flex" : "xl:hidden",
        )}
      >
        <div>
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--bv-ink-3)]">
              Progress
            </span>
            <button
              className="hidden size-6 items-center justify-center rounded-md transition-colors hover:bg-gray-100 xl:flex"
              onClick={() => setOpen(false)}
              type="button"
              aria-label="Close progress panel"
            >
              <PanelRightCloseIcon className="size-3.5 text-[var(--bv-ink-3)]" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
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
            <UnansweredReveal reviewReached={showReview} sessionId={sessionId}>
              <ReviewReadyReveal
                complete={totalRemaining === 0}
                panelOpen={open}
                reviewHref={`${ROUTES.questionnaire}?review=1`}
                totalQuestions={totalQuestions}
                warning={
                  <div className="border-t border-[var(--bv-line)] pt-4">
                    <div className="flex items-center gap-3 rounded-[8px] bg-white px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.06),0px_1px_3px_0px_rgba(16,24,40,0.10)]">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <div className="flex shrink-0 items-start pt-0.5">
                          <CircleCheckIcon className="size-4 text-[#dc7609]" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                          <p className="overflow-hidden text-ellipsis text-[14px] font-semibold leading-5 text-[#dc7609]">
                            {totalRemaining} uncompleted{" "}
                            {totalRemaining === 1 ? "question" : "questions"}.
                          </p>
                          <div className="flex flex-col">
                            {incompleteSections.map((section) => {
                              const remaining =
                                section.totalQuestions -
                                section.completedQuestions;
                              return (
                                <div
                                  key={section.id}
                                  className="flex flex-col items-start"
                                >
                                  <span className="text-[14px] font-medium leading-5 text-[#0a0a0a]">
                                    {section.title}:
                                  </span>
                                  <Link
                                    className="text-[12px] leading-4 text-[#844705] underline"
                                    href={`${questionnaireSectionPath(section.key)}?validate=1`}
                                  >
                                    {remaining} uncompleted
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              />
            </UnansweredReveal>
          </div>
        </div>
      </aside>
    </>
  );
}
