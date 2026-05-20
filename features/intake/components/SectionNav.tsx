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
    <nav aria-label="Intake sections" className="grid gap-2 md:grid-cols-2">
      {sections.map((section) => {
        const progress = progressBySectionKey.get(section.key);
        const isActive = section.key === selectedSectionKey;

        return (
          <Link
            className={cn(
              "rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-muted",
              isActive && "border-primary bg-muted",
            )}
            href={`/dashboard/intake/${section.key}`}
            key={section.id}
          >
            <span className="block font-medium">{section.title}</span>
            <span className="mt-1 block font-mono text-xs text-muted-foreground">
              {progress?.answeredQuestions ?? 0}/{progress?.totalQuestions ?? 0}{" "}
              answered
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
