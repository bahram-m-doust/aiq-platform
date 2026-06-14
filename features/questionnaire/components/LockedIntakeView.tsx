import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IntakeProgress } from "@/features/questionnaire/components/IntakeProgress";
import { SectionNav } from "@/features/questionnaire/components/SectionNav";
import { SimpleChangeRequestDialog } from "@/features/change-requests/components/SimpleChangeRequestDialog";
import type { IntakeAnswerValue, IntakePageData } from "@/features/questionnaire/types";

function formatAnswerValue(value: IntakeAnswerValue) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "No answer recorded";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return "No answer recorded";
}

export function LockedIntakeView({
  data,
  selectedSectionKey,
}: {
  data: IntakePageData;
  selectedSectionKey: string | null;
}) {
  const selectedSection =
    data.sections.find((section) => section.key === selectedSectionKey) ??
    data.sections[0] ??
    null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Strategic Intake is locked</CardTitle>
          <CardDescription>
            Final submission has been recorded for {data.access.brandName}.
            Direct editing is disabled. Any required correction must be
            submitted as a Change Request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p>
              Locked at{" "}
              <span className="font-mono text-foreground">
                {data.session.lockedAt ?? "recorded submission time"}
              </span>
            </p>
          </div>
          {selectedSection ? (
            <SimpleChangeRequestDialog
              sectionKey={selectedSection.key}
            >
              <Button type="button">Request a Change</Button>
            </SimpleChangeRequestDialog>
          ) : null}
          <IntakeProgress completion={data.completion} />
          <SectionNav
            completion={data.completion}
            sections={data.sections}
            selectedSectionKey={selectedSection?.key ?? null}
          />
        </CardContent>
      </Card>

      {selectedSection ? (
        <Card>
          <CardHeader>
            <CardTitle>{selectedSection.title}</CardTitle>
            <CardDescription>
              Locked answers are shown for reference only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedSection.questions.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                No approved questions are currently configured for this
                section.
              </p>
            ) : (
              selectedSection.questions.map((question) => (
                <article
                  className="rounded-lg border border-border p-4"
                  key={question.id}
                >
                  <div className="space-y-2">
                    <h2 className="text-base leading-6 font-medium">
                      {question.questionText}
                    </h2>
                    {question.helpText ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {question.helpText}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm leading-6 whitespace-pre-wrap">
                    {formatAnswerValue(data.answers[question.id] ?? null)}
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
