import Link from "next/link";
import { Check } from "lucide-react";

import { questionnaireSectionPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type {
  IntakeCompletion,
  IntakeSectionProgress,
} from "@/features/questionnaire/types";

type StepStatus = "complete" | "current" | "upcoming";

function resolveStepStatus(
  section: IntakeSectionProgress,
  isActive: boolean,
): StepStatus {
  if (section.totalQuestions > 0 && section.answeredQuestions >= section.totalQuestions) {
    return "complete";
  }

  return isActive ? "current" : "upcoming";
}

function StepBadge({ status, index }: { status: StepStatus; index: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        status === "complete" && "bg-primary-foreground/20 text-current",
        status === "current" && "bg-primary-foreground/20 text-current",
        status === "upcoming" && "bg-background/70 text-muted-foreground",
      )}
    >
      {status === "complete" ? (
        <Check className="size-3.5" strokeWidth={3} />
      ) : (
        index + 1
      )}
    </span>
  );
}

/**
 * A step-based progress indicator. Instead of a single anonymous bar, it shows
 * the full list of sections a user must complete, marks the ones already done,
 * highlights where they currently are, and reveals what is coming up next — so
 * the finish line always feels in sight. A running total reinforces how each
 * answer moves them toward Final Submit.
 */
export function IntakeProgress({
  completion,
  selectedSectionKey,
}: {
  completion: IntakeCompletion;
  selectedSectionKey?: string | null;
}) {
  const completedSections = completion.sections.filter(
    (section) =>
      section.totalQuestions > 0 &&
      section.answeredQuestions >= section.totalQuestions,
  ).length;
  const totalSections = completion.sections.length;

  // Fall back to the first not-yet-complete section when nothing is selected so
  // "where you are" is always meaningful.
  const activeSectionKey =
    selectedSectionKey ??
    completion.sections.find(
      (section) =>
        !(
          section.totalQuestions > 0 &&
          section.answeredQuestions >= section.totalQuestions
        ),
    )?.sectionKey ??
    completion.sections[0]?.sectionKey ??
    null;

  return (
    <section className="space-y-4" aria-label="Intake progress">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Your progress</p>
          <p className="text-sm text-muted-foreground">
            {completion.answeredQuestions} of {completion.totalQuestions}{" "}
            required questions answered
            {totalSections > 0
              ? ` · ${completedSections} of ${totalSections} sections complete`
              : ""}
            .
          </p>
        </div>
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {completion.completionPercent}%
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion.completionPercent}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${Math.min(Math.max(completion.completionPercent, 0), 100)}%`,
          }}
        />
      </div>

      {totalSections > 0 ? (
        <ol className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-stretch">
          {completion.sections.map((section, index) => {
            const isActive = section.sectionKey === activeSectionKey;
            const status = resolveStepStatus(section, isActive);

            return (
              <li className="md:min-w-0 md:flex-1" key={section.sectionId}>
                <Link
                  aria-current={status === "current" ? "step" : undefined}
                  className={cn(
                    "group flex h-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    status === "complete" &&
                      "border-primary/40 bg-primary/80 text-primary-foreground hover:bg-primary",
                    status === "current" &&
                      "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary",
                    status === "upcoming" &&
                      "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
                  )}
                  href={questionnaireSectionPath(section.sectionKey)}
                >
                  <StepBadge index={index} status={status} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {section.title}
                    </span>
                    <span
                      className={cn(
                        "block font-mono text-xs",
                        status === "upcoming"
                          ? "text-muted-foreground"
                          : "text-primary-foreground/80",
                      )}
                    >
                      {section.answeredQuestions}/{section.totalQuestions}{" "}
                      answered
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
