import type { IntakeCompletion } from "@/features/questionnaire/types";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

export function IntakeProgress({ completion }: { completion: IntakeCompletion }) {
  return (
    <section className="space-y-4" aria-label="Questionnaire progress">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Total completion</span>
          <span className="font-mono text-muted-foreground">
            {completion.completionPercent}%
          </span>
        </div>
        <ProgressBar value={completion.completionPercent} />
        <p className="text-sm text-muted-foreground">
          {completion.answeredQuestions} of {completion.totalQuestions} required
          questions answered.
        </p>
      </div>

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
            <ProgressBar value={section.completionPercent} />
          </div>
        ))}
      </div>
    </section>
  );
}
