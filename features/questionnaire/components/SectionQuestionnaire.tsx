"use client";

import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircleIcon, DownloadIcon, LockIcon } from "lucide-react";

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

  const sectionIndex = allSections.findIndex((item) => item.id === section.id) + 1;

  const tabListRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const hasMeasuredTabIndicatorRef = useRef(false);
  const tabIndicatorFrameRef = useRef<number | null>(null);
  const [pendingSection, setPendingSection] = useState<{
    fromId: string;
    toId: string;
  } | null>(null);
  const [tabIndicator, setTabIndicator] = useState({
    left: 0,
    ready: false,
    width: 0,
  });
  const [animateTabIndicator, setAnimateTabIndicator] = useState(false);
  const [showErrors] = useState(autoValidate);
  const visualSectionId =
    pendingSection?.fromId === section.id ? pendingSection.toId : section.id;

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
  }, [allSections.length, visualSectionId]);

  const moveTabIndicatorTo = (
    target: HTMLAnchorElement,
    nextSectionId: string,
  ) => {
    setPendingSection({ fromId: section.id, toId: nextSectionId });
    setAnimateTabIndicator(true);
    setTabIndicator({
      left: target.offsetLeft,
      ready: true,
      width: target.offsetWidth,
    });
  };

  const handleSectionTabPointerDown = (
    event: PointerEvent<HTMLAnchorElement>,
    nextSectionId: string,
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      nextSectionId === section.id
    ) {
      return;
    }

    moveTabIndicatorTo(event.currentTarget, nextSectionId);
  };

  const handleSectionTabClick = (
    event: MouseEvent<HTMLAnchorElement>,
    nextSectionId: string,
  ) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      nextSectionId === section.id
    ) {
      return;
    }

    moveTabIndicatorTo(event.currentTarget, nextSectionId);
  };

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
            <Link href="/integrated-brand-brain/roadmap/questionnaire">
              <ArrowLeftIcon className="size-3.5" />
              Questionnaire overview
            </Link>
          </Button>
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

          <div className="mt-5">
            <div className="overflow-x-auto rounded-lg bg-muted p-1.5 scrollbar-hide">
              <div
                className="relative flex min-w-max w-full items-center gap-0.5"
                ref={tabListRef}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-0 z-0 rounded-md border border-transparent bg-background shadow-sm",
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
                  const isActive = item.id === section.id;
                  const isVisualActive = item.id === visualSectionId;
                  const href = `/integrated-brand-brain/roadmap/questionnaire/${item.key}`;
                  const questionIds = item.questions.map(
                    (question) => question.id,
                  );
                  const answered = questionIds.filter((id) =>
                    isIntakeAnswerComplete(displayedAnswers[id] ?? null),
                  ).length;
                  const isComplete =
                    answered === item.questions.length &&
                    item.questions.length > 0;

                  return (
                    <Link
                      aria-label={`${item.title} ${answered}/${item.questions.length}`}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative z-10 inline-flex h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md border border-transparent px-2 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-200",
                        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        isVisualActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      href={href}
                      key={item.id}
                      onClick={(event) =>
                        handleSectionTabClick(event, item.id)
                      }
                      onPointerDown={(event) =>
                        handleSectionTabPointerDown(event, item.id)
                      }
                      ref={isVisualActive ? activeTabRef : undefined}
                    >
                      <span className="inline-flex w-full min-w-0 items-center justify-center gap-1 leading-5">
                        {isComplete && (
                          <CheckCircleIcon className="size-3.5 text-emerald-500" />
                        )}
                        <span className="truncate">{item.title}</span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[10px] font-medium leading-3",
                          isVisualActive
                            ? "text-[var(--bv-ink-3)]"
                            : "text-muted-foreground/75",
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
          {section.questions.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-xs">
              No questions configured for this section yet.
            </div>
          ) : (
            section.questions.map((question, index) => (
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
                      ? `/integrated-brand-brain/roadmap/questionnaire/${allSections[sectionIndex - 2].key}`
                      : undefined
                  }
                />
              </PaginationItem>
              {allSections.map((item, index) => (
                <PaginationItem key={item.key}>
                  <PaginationLink
                    href={`/integrated-brand-brain/roadmap/questionnaire/${item.key}`}
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
                      ? `/integrated-brand-brain/roadmap/questionnaire/${allSections[allSections.length - 1].key}`
                      : undefined
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <div className="flex items-center justify-between">
            <Button asChild className="text-[var(--bv-ink-3)] hover:text-[var(--bv-ink)]" variant="ghost">
              <Link href="/integrated-brand-brain/roadmap/questionnaire">
                <ArrowLeftIcon className="size-3.5" />
                Questionnaire overview
              </Link>
            </Button>

            {sectionIndex < allSections.length ? (
              <Button asChild className="group" variant="outline">
                <Link
                  href={`/integrated-brand-brain/roadmap/questionnaire/${allSections[sectionIndex].key}`}
                >
                  Next: {allSections[sectionIndex].title}
                  <span className="text-[var(--bv-ink-4)] transition-transform group-hover:translate-x-0.5">
                    -&gt;
                  </span>
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/integrated-brand-brain/roadmap/questionnaire?review=1">Review &amp; submit</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
