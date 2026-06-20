"use client";

import {
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ArrowLeftIcon, DownloadIcon, LockIcon } from "lucide-react";

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
import { ROUTES, questionnaireSectionPath } from "@/lib/routes";
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

  // Section switching is client-side: every section + its answers are already
  // loaded, and the autosave queue is keyed by the session (not the section),
  // so moving between sections needs no server round-trip — it's instant and
  // free of the navigation glitch. We only sync the URL (replaceState) so
  // refresh / sharing still resolve. `section` (the server prop) is just the
  // section the page was entered on.
  const [activeSectionId, setActiveSectionId] = useState(section.id);
  const activeSection =
    allSections.find((item) => item.id === activeSectionId) ?? section;
  const sectionIndex =
    allSections.findIndex((item) => item.id === activeSectionId) + 1;

  const switchToSection = useCallback(
    (targetId: string, targetKey: string) => {
      if (targetId === activeSectionId) return;
      setActiveSectionId(targetId);
      window.history.replaceState(
        window.history.state,
        "",
        questionnaireSectionPath(targetKey),
      );
    },
    [activeSectionId],
  );

  const handleSectionLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    targetId: string,
    targetKey: string,
  ) => {
    // Let modifier / middle clicks fall through to a real navigation (new tab).
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    switchToSection(targetId, targetKey);
  };

  const tabListRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const hasMeasuredTabIndicatorRef = useRef(false);
  const tabIndicatorFrameRef = useRef<number | null>(null);
  const [tabIndicator, setTabIndicator] = useState({
    left: 0,
    ready: false,
    width: 0,
  });
  const [animateTabIndicator, setAnimateTabIndicator] = useState(false);
  const [showErrors] = useState(autoValidate);

  // Sticky tab bar: a zero-height sentinel sits where the bar starts. Once it
  // scrolls past the viewport top the bar is "stuck", and we wrap it in a
  // compact floating header so the section tabs (and their answered/total
  // progress) stay reachable while scrolling a long section.
  const stickySentinelRef = useRef<HTMLDivElement>(null);
  const [tabBarStuck, setTabBarStuck] = useState(false);

  useEffect(() => {
    const sentinel = stickySentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setTabBarStuck(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (tabIndicatorFrameRef.current) {
        window.cancelAnimationFrame(tabIndicatorFrameRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const measureActiveTab = (animate: boolean) => {
      const activeTab = activeTabRef.current;

      if (!activeTab) return;

      setAnimateTabIndicator(animate);
      setTabIndicator({
        left: activeTab.offsetLeft,
        ready: true,
        width: activeTab.offsetWidth,
      });

      if (!hasMeasuredTabIndicatorRef.current) {
        hasMeasuredTabIndicatorRef.current = true;
        tabIndicatorFrameRef.current = window.requestAnimationFrame(() => {
          setAnimateTabIndicator(true);
          tabIndicatorFrameRef.current = null;
        });
      }
    };

    measureActiveTab(hasMeasuredTabIndicatorRef.current);

    const tabList = tabListRef.current;
    const activeTab = activeTabRef.current;

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () =>
        measureActiveTab(hasMeasuredTabIndicatorRef.current);

      window.addEventListener("resize", handleResize);

      return () => window.removeEventListener("resize", handleResize);
    }

    const observer = new ResizeObserver(() =>
      measureActiveTab(hasMeasuredTabIndicatorRef.current),
    );

    if (tabList) observer.observe(tabList);
    if (activeTab) observer.observe(activeTab);

    const handleResize = () =>
      measureActiveTab(hasMeasuredTabIndicatorRef.current);

    window.addEventListener("resize", handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [allSections.length, activeSectionId]);

  // Arrived here from the overview's "fix this" link — highlight the gaps and
  // jump to the first unanswered question.
  useEffect(() => {
    if (!autoValidate) return;
    const firstEmpty = activeSection.questions.find(
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
            <Link href={ROUTES.questionnaire}>
              <ArrowLeftIcon className="size-3.5" />
              Questionnaire overview
            </Link>
          </Button>
        </div>

        <div className="mb-5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
            Brand Research - Phase 01
          </span>

          <div className="mt-1.5 flex items-baseline gap-2.5">
            <span className="shrink-0 text-2xl font-semibold tracking-[-0.02em] text-[var(--bv-ink-4)]">
              {sectionIndex}
            </span>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">
              {activeSection.title}
            </h1>
          </div>

          {activeSection.description && (
            <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
              {activeSection.description}
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
                <QuestionnaireChangeRequestDialog
                  sectionKey={activeSection.key}
                  triggerClassName="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--bv-line)] bg-white px-3 py-1 text-[12px] font-medium text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
                />
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
        </div>

        {/* Sentinel marks where the tab bar begins; when it scrolls past the
            viewport top the sticky bar below switches to its compact state. */}
        <div ref={stickySentinelRef} aria-hidden="true" className="h-0" />

        {/* Sticky section tabs — stay pinned while scrolling a long section so
            the user always knows where they are and can jump sections fast. */}
        <div className="sticky top-0 z-30 mb-9">
          <div
            className={cn(
              // Border width + padding stay constant so toggling the stuck
              // state never shifts layout — only the frame/shadow fade in.
              "rounded-xl border transition-[background-color,border-color,box-shadow] duration-200",
              tabBarStuck
                ? "border-[var(--bv-line)] bg-white shadow-[0_14px_32px_-22px_rgba(15,15,20,0.55)]"
                : "border-transparent bg-transparent",
            )}
          >
            <div className="overflow-x-auto scrollbar-hide">
              <div
                className="relative flex min-w-max w-full items-center"
                ref={tabListRef}
              >
                {/* Figma: full-width sidebar-border baseline, with the active
                    tab marked by a sliding primary 1px underline. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-border"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute bottom-0 left-0 z-[1] h-0.5 bg-primary",
                    animateTabIndicator
                      ? "transition-[transform,width,opacity] duration-500"
                      : "transition-none",
                  )}
                  style={{
                    opacity: tabIndicator.ready ? 1 : 0,
                    transform: `translateX(${tabIndicator.left}px)`,
                    transitionTimingFunction: "var(--bv-ease)",
                    width: tabIndicator.width,
                  }}
                />
                {allSections.map((item) => {
                  const isActive = item.id === activeSectionId;
                  const href = questionnaireSectionPath(item.key);
                  const questionIds = item.questions.map(
                    (question) => question.id,
                  );
                  const answered = questionIds.filter((id) =>
                    isIntakeAnswerComplete(displayedAnswers[id] ?? null),
                  ).length;

                  return (
                    <Link
                      aria-label={`${item.title} ${answered}/${item.questions.length}`}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative z-10 inline-flex h-16 flex-auto items-center justify-center gap-2 rounded-md px-2.5 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-200",
                        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      href={href}
                      key={item.id}
                      onClick={(event) =>
                        handleSectionLinkClick(event, item.id, item.key)
                      }
                      ref={isActive ? activeTabRef : undefined}
                    >
                      <span>{item.title}</span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[10px] font-medium tabular-nums",
                          isActive
                            ? "text-[var(--bv-ink-3)]"
                            : "text-muted-foreground/70",
                        )}
                      >
                        {answered}/{item.questions.length}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {activeSection.questions.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-xs">
              No questions configured for this section yet.
            </div>
          ) : (
            activeSection.questions.map((question, index) => (
              <div
                className="flex flex-col gap-12 rounded-lg border border-border bg-card p-6 shadow-xs transition-colors duration-200 focus-within:bg-[#F2F2F2]"
                id={`question-card-${question.id}`}
                key={question.id}
              >
                <div className="flex w-full min-w-0 items-start gap-2">
                  <span className="shrink-0 font-mono text-xs leading-4 text-muted-foreground">
                    {sectionIndex}.{String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="min-w-0 text-sm font-medium leading-none text-foreground">
                    {question.questionText}
                  </h2>
                </div>

                <div className="flex w-full flex-col gap-6">
                  {question.helpText && (
                    <p className="text-sm font-medium leading-none text-muted-foreground">
                      {question.helpText}
                    </p>
                  )}
                  {locked ? (
                    <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm leading-6 whitespace-pre-wrap text-foreground shadow-xs">
                      {formatAnswerValue(displayedAnswers[question.id] ?? null)}
                    </div>
                  ) : (
                    <QuestionRenderer
                      hidePrompt
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
                      ? questionnaireSectionPath(allSections[sectionIndex - 2].key)
                      : undefined
                  }
                  onClick={(event) => {
                    const target = allSections[sectionIndex - 2];
                    if (target) {
                      handleSectionLinkClick(event, target.id, target.key);
                    }
                  }}
                />
              </PaginationItem>
              {allSections.map((item, index) => (
                <PaginationItem key={item.key}>
                  <PaginationLink
                    href={questionnaireSectionPath(item.key)}
                    isActive={index + 1 === sectionIndex}
                    onClick={(event) =>
                      handleSectionLinkClick(event, item.id, item.key)
                    }
                  >
                    {index + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationLast
                  href={
                    sectionIndex < allSections.length
                      ? questionnaireSectionPath(allSections[allSections.length - 1].key)
                      : undefined
                  }
                  onClick={(event) => {
                    const target = allSections[allSections.length - 1];
                    if (target) {
                      handleSectionLinkClick(event, target.id, target.key);
                    }
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <div className="flex items-center justify-between">
            <Button asChild className="text-[var(--bv-ink-3)] hover:text-[var(--bv-ink)]" variant="ghost">
              <Link href={ROUTES.questionnaire}>
                <ArrowLeftIcon className="size-3.5" />
                Questionnaire overview
              </Link>
            </Button>

            {sectionIndex < allSections.length ? (
              <Button asChild className="group" variant="outline">
                <Link
                  href={questionnaireSectionPath(allSections[sectionIndex].key)}
                  onClick={(event) =>
                    handleSectionLinkClick(
                      event,
                      allSections[sectionIndex].id,
                      allSections[sectionIndex].key,
                    )
                  }
                >
                  Next: {allSections[sectionIndex].title}
                  <span className="text-[var(--bv-ink-4)] transition-transform group-hover:translate-x-0.5">
                    -&gt;
                  </span>
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`${ROUTES.questionnaire}?review=1`}>Review &amp; submit</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
