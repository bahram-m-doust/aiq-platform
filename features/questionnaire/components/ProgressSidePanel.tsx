"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
  totalCompleted,
  completionPercent,
  sections,
  sessionId,
  showReview,
  showReadyReviewAction = true,
  defaultOpen = true,
}: {
  totalQuestions: number;
  totalCompleted: number;
  completionPercent: number;
  sections: SectionSummary[];
  sessionId: string;
  showReview: boolean;
  showReadyReviewAction?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const incompleteSections = sections.filter(
    (s) => s.completedQuestions < s.totalQuestions,
  );
  const totalRemaining = totalQuestions - totalCompleted;

  return (
    <>
      {!open && (
        <button
          className="mx-auto mt-8 flex w-full max-w-[480px] items-center justify-between rounded-[12px] border border-[var(--bv-line)] bg-card px-4 py-3 text-left shadow-xs transition-colors hover:bg-gray-50 xl:hidden"
          onClick={() => setOpen(true)}
          type="button"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--bv-ink-4)]">
              Progress
            </span>
            <span className="text-[12px] font-medium text-[var(--bv-ink-2)]">
              {totalCompleted}/{totalQuestions} completed questions
            </span>
          </div>
          <PanelRightOpenIcon className="size-4 text-[var(--bv-ink-3)]" />
        </button>
      )}

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
          "mx-auto mt-8 flex w-full max-w-[480px] flex-col gap-4 rounded-[12px] border border-border bg-card px-4 py-4 shadow-xs",
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

          <div className="flex flex-col gap-3 pt-1.5">
            <div className="flex flex-col gap-6 rounded-lg bg-[#f7f7f8] px-3 py-6">
              <div className="flex items-center justify-between text-[12px] leading-none tracking-[0.48px]">
                <span className="font-semibold text-[#64748b]">
                  Completed questions
                </span>
                <span className="font-mono font-medium text-[#009760]">
                  {totalCompleted}/{totalQuestions}
                </span>
              </div>
              <ProgressBar color="green" value={completionPercent} />
            </div>

            <div className="border-t border-[var(--bv-line)] pt-3">
              <span className="mb-3 block text-[10px] font-semibold uppercase tracking-widest text-[var(--bv-ink-4)]">
                Section progress
              </span>
              <ul className="flex flex-col gap-2">
                {sections.map((section) => (
                  <li key={section.id}>
                    <Link
                      className="group flex items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 text-xs transition-colors hover:bg-gray-50"
                      href={questionnaireSectionPath(section.key)}
                    >
                      <span className="min-w-0 flex-1 break-words font-medium leading-4 text-[var(--bv-ink-2)] group-hover:text-[var(--bv-ink)]">
                        {section.title}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--bv-ink-4)]">
                        {section.completedQuestions} of {section.totalQuestions}
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
                showReadyAction={showReadyReviewAction}
                totalQuestions={totalQuestions}
                warning={
                  <div className="border-t border-[var(--bv-line)] pt-4">
                    <Alert
                      className="relative overflow-hidden border-amber-300/80 bg-[#fffbeb] text-[var(--bv-ink)] shadow-xs"
                    >
                      <AlertDescription className="flex max-w-full items-start gap-2 pr-1 text-[13px] leading-5 text-[#78350f]">
                        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-[#b45309]" />
                        <span>
                          Answer{" "}
                          <span className="font-semibold text-[#9a5a04]">
                            {totalRemaining} more{" "}
                            {totalRemaining === 1 ? "question" : "questions"}
                          </span>{" "}
                          to unlock submission.
                        </span>
                      </AlertDescription>
                      <div className="mt-3 flex flex-col gap-2">
                        {incompleteSections.map((section) => {
                          const remaining =
                            section.totalQuestions -
                            section.completedQuestions;
                          return (
                            <Link
                              key={section.id}
                              href={`${questionnaireSectionPath(section.key)}?validate=1`}
                              className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-amber-200/80 bg-[#fff7ed] px-3 py-2 text-[#78350f] transition-all hover:border-amber-300 hover:bg-[#fffbeb] hover:shadow-sm"
                            >
                              <span className="min-w-0">
                                <span className="block break-words text-[12px] font-medium leading-4 text-[#78350f]">
                                  {section.title}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold leading-4 text-[#9a5a04] ring-1 ring-amber-200/80">
                                  {remaining} left
                                </span>
                                <ArrowRightIcon className="size-3.5 flex-none text-[#b45309] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#92400e]" />
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </Alert>
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
