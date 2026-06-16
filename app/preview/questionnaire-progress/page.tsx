import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IntakeProgress } from "@/features/questionnaire/components/IntakeProgress";
import type { IntakeCompletion } from "@/features/questionnaire/types";

// Standalone, auth-free preview of the step-based intake progress indicator.
// Not part of the product flow — it exists purely so the component can be
// reviewed locally without Supabase or a signed-in session.
//
// View at: http://localhost:3000/preview/questionnaire-progress

function makeSection(
  title: string,
  answered: number,
  total: number,
): IntakeCompletion["sections"][number] {
  const sectionKey = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    sectionId: `preview-${sectionKey}`,
    sectionKey,
    title,
    totalQuestions: total,
    answeredQuestions: answered,
    completionPercent:
      total === 0 ? 0 : Math.round((answered / total) * 100),
  };
}

function buildCompletion(
  sections: IntakeCompletion["sections"],
): IntakeCompletion {
  const totalQuestions = sections.reduce((sum, s) => sum + s.totalQuestions, 0);
  const answeredQuestions = sections.reduce(
    (sum, s) => sum + s.answeredQuestions,
    0,
  );
  return {
    totalQuestions,
    answeredQuestions,
    completionPercent:
      totalQuestions === 0
        ? 0
        : Math.round((answeredQuestions / totalQuestions) * 100),
    sections,
  };
}

// A realistic mid-progress journey: two sections done, the user sitting in the
// third, and the rest still ahead.
const inProgress = buildCompletion([
  makeSection("Brand Foundation", 5, 5),
  makeSection("Audience & Market", 4, 4),
  makeSection("Positioning", 2, 6),
  makeSection("Voice & Messaging", 0, 5),
  makeSection("Visual Direction", 0, 4),
  makeSection("Goals & Metrics", 0, 3),
]);

// A fresh start: nothing answered yet.
const justStarted = buildCompletion([
  makeSection("Brand Foundation", 0, 5),
  makeSection("Audience & Market", 0, 4),
  makeSection("Positioning", 0, 6),
  makeSection("Voice & Messaging", 0, 5),
  makeSection("Visual Direction", 0, 4),
  makeSection("Goals & Metrics", 0, 3),
]);

// Almost there: a single section left to nudge the user over the line.
const nearlyDone = buildCompletion([
  makeSection("Brand Foundation", 5, 5),
  makeSection("Audience & Market", 4, 4),
  makeSection("Positioning", 6, 6),
  makeSection("Voice & Messaging", 5, 5),
  makeSection("Visual Direction", 4, 4),
  makeSection("Goals & Metrics", 1, 3),
]);

export default function QuestionnaireProgressPreviewPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          Intake progress — preview
        </h1>
        <p className="text-sm text-muted-foreground">
          Mock-only view of the step-based progression indicator. Steps link to
          section routes that won&apos;t resolve here — that&apos;s expected.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>In progress</CardTitle>
          <CardDescription>
            Two sections complete, currently working through &ldquo;Positioning&rdquo;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntakeProgress
            completion={inProgress}
            selectedSectionKey="positioning"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Just started</CardTitle>
          <CardDescription>
            Nothing answered yet — the first section is highlighted as current.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntakeProgress completion={justStarted} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nearly done</CardTitle>
          <CardDescription>
            Finish line in sight — only the last section remains.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntakeProgress
            completion={nearlyDone}
            selectedSectionKey="goals-metrics"
          />
        </CardContent>
      </Card>
    </main>
  );
}
