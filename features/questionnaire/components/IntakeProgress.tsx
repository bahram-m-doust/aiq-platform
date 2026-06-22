import { ProgressBar } from "@/components/ui/progress-bar";
import { QuestionnaireProgressSummary } from "@/features/questionnaire/components/QuestionnaireProgressSummary";
import type { IntakeCompletion } from "@/features/questionnaire/types";

export function IntakeProgress({ completion }: { completion: IntakeCompletion }) {
  return (
    <section className="space-y-4" aria-label="Questionnaire progress">
      <QuestionnaireProgressSummary
        answeredQuestions={completion.answeredQuestions}
        completionPercent={completion.completionPercent}
        totalQuestions={completion.totalQuestions}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {completion.sections.map((section) => (
          <div
            className="rounded-lg border border-border p-3"
            key={section.sectionId}
          >
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{section.title}</span>
              <span className="font-mono text-muted-foreground">
                {section.completionPercent}%
              </span>
            </div>
            <ProgressBar color="green" value={section.completionPercent} />
          </div>
        ))}
      </div>
    </section>
  );
}
