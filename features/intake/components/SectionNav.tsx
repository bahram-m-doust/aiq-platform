import Link from "next/link";

import type { IntakeCompletion, IntakeSectionWithQuestions } from "@/features/intake/types";
import { cn } from "@/lib/utils";

export function SectionNav({
  sections,
  completion,
  selectedSectionKey,
}: {
  sections: IntakeSectionWithQuestions[];
  completion: IntakeCompletion;
  selectedSectionKey: string | null;
}) {
  const progressBySectionKey = new Map(
    completion.sections.map((section) => [section.sectionKey, section]),
  );

  return (
    <nav
      aria-label="Intake sections"
      className="flex h-9 items-center gap-1 overflow-x-auto rounded-lg bg-muted p-[3px]"
    >
      {sections.map((section) => {
        const progress = progressBySectionKey.get(section.key);
        const answered = progress?.answeredQuestions ?? 0;
        const total = progress?.totalQuestions ?? section.questions.length;
        const isActive = section.key === selectedSectionKey;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              // Tabs / Trigger — base
              "relative flex h-full min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground outline-none transition-[color,background-color,box-shadow]",
              // Focus state — border + ring matching the component
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              // Active state — white surface + sm shadow
              isActive && "bg-background shadow-sm",
            )}
            href={`/dashboard/questionnaire/${section.key}`}
            key={section.id}
            title={section.title}
          >
            <span className="truncate">{section.title}</span>
            {total > 0 && (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground shadow-sm">
                {answered}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
