"use client";

import { useMemo } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  calculateIntakeCompletion,
  isIntakeSessionLocked,
} from "@/features/intake/schemas";
import { FinalSubmitReadiness } from "@/features/intake/components/FinalSubmitReadiness";
import { IntakeProgress } from "@/features/intake/components/IntakeProgress";
import { LockedIntakeView } from "@/features/intake/components/LockedIntakeView";
import { QuestionRenderer } from "@/features/intake/components/QuestionRenderer";
import { useIntakeAutosaveQueue } from "@/features/intake/components/useIntakeAutosaveQueue";
import { SectionNav } from "@/features/intake/components/SectionNav";
import type {
  IntakePageData,
} from "@/features/intake/types";

function IntakeEmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategic Intake is awaiting its question bank</CardTitle>
        <CardDescription>
          The six intake sections are loaded from the database. Questions will
          appear here once the approved question bank is imported.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function StrategicIntakeWorkspace({
  data,
  selectedSectionKey,
}: {
  data: IntakePageData;
  selectedSectionKey: string | null;
}) {
  const {
    answers,
    enqueueAnswer,
    hasPendingSaves,
    retryQuestion,
    saveStates,
  } = useIntakeAutosaveQueue({
    sessionId: data.session.id,
    initialAnswers: data.answers,
  });
  const completion = useMemo(
    () => calculateIntakeCompletion({ sections: data.sections, answers }),
    [answers, data.sections],
  );
  const selectedSection =
    data.sections.find((section) => section.key === selectedSectionKey) ??
    data.sections[0] ??
    null;

  if (isIntakeSessionLocked(data.session)) {
    return (
      <LockedIntakeView
        data={data}
        selectedSectionKey={selectedSection?.key ?? null}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Strategic Brand Intake</CardTitle>
          <CardDescription>
            Provide the strategic foundation for {data.access.brandName}. Every
            question is required before Final Submit becomes available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <IntakeProgress completion={completion} />
          <SectionNav
            completion={completion}
            sections={data.sections}
            selectedSectionKey={selectedSection?.key ?? null}
          />
        </CardContent>
      </Card>

      {!selectedSection ? (
        <IntakeEmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{selectedSection.title}</CardTitle>
            <CardDescription>
              {selectedSection.description ??
                "Complete this section with precise, executive-ready context."}
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
                <QuestionRenderer
                  key={question.id}
                  onQueuedChange={enqueueAnswer}
                  onRetryQueuedSave={retryQuestion}
                  question={question}
                  saveState={saveStates[question.id]}
                  sessionId={data.session.id}
                  value={answers[question.id] ?? null}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}

      <FinalSubmitReadiness
        completion={completion}
        disabled={hasPendingSaves}
        sessionId={data.session.id}
      />
    </div>
  );
}
