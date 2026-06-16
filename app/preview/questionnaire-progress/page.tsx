import { SectionQuestionnaire } from "@/features/questionnaire/components/SectionQuestionnaire";
import type {
  IntakeAnswerMap,
  IntakeCompletion,
  IntakeQuestion,
  IntakeSectionWithQuestions,
  IntakeSession,
} from "@/features/questionnaire/types";

// Standalone, auth-free preview of the questionnaire section page so the
// progress indicator can be reviewed locally without Supabase or a signed-in
// session. Editing a field here will fail to autosave (no backend) — that's
// expected; this page only exists to inspect the layout.
//
// View at: http://localhost:3000/preview/questionnaire-progress

function makeSection(
  orderIndex: number,
  key: string,
  title: string,
  description: string,
  questionTexts: string[],
): IntakeSectionWithQuestions {
  const id = `preview-sec-${key}`;
  const questions: IntakeQuestion[] = questionTexts.map((text, index) => ({
    id: `${key}-q${index + 1}`,
    sectionId: id,
    key: `${key}_q${index + 1}`,
    questionText: text,
    helpText: null,
    inputType: "textarea",
    isRequired: true,
    orderIndex: index + 1,
    validationSchema: null,
  }));

  return { id, key, title, description, orderIndex, isRequired: true, questions };
}

const sections: IntakeSectionWithQuestions[] = [
  makeSection(1, "COMPANY", "Company", "Who you are and what you do.", [
    "Company name and one-line description",
    "Founding story and mission",
    "Core offering",
    "Stage and size",
  ]),
  makeSection(
    2,
    "CONSUMER_MARKET_SEGMENTATION",
    "Consumer / Market Segmentation",
    "Define your primary, main, and secondary target audiences.",
    [
      "Definition of primary, main, and secondary target audiences",
      "Target Audience Demographics Definition",
      "Target Audience Psychographics Definition",
      "Target Audience Economic Characteristics",
      "Market segments you compete in",
    ],
  ),
  makeSection(3, "USER_PERSONA", "User Persona", "Who you are speaking to.", [
    "Primary persona snapshot",
    "Goals and motivations",
    "Pain points",
    "Buying triggers",
  ]),
  makeSection(
    4,
    "PRODUCTS_SERVICES",
    "Products / Services",
    "What you sell and how it is positioned.",
    [
      "Product / service line-up",
      "Key differentiators",
      "Pricing posture",
      "Proof points",
    ],
  ),
  makeSection(5, "CONTEXT", "Context", "The world your brand lives in.", [
    "Competitive landscape",
    "Category trends",
    "Constraints and risks",
  ]),
  makeSection(
    6,
    "STYLE_TONE_OF_VOICE",
    "Style / Tone of Voice",
    "How the brand should sound.",
    [
      "Voice in three words",
      "Words and phrases to embrace",
      "Words and phrases to avoid",
      "Reference brands for tone",
    ],
  ),
];

// Mirror the reported screenshot: the first two sections are fully answered —
// including the *current* one — while the rest of the journey is untouched.
// The old bar showed 100% here (current section only); the new bar shows the
// true overall progress.
const answers: IntakeAnswerMap = {};
for (const section of sections.slice(0, 2)) {
  for (const question of section.questions) {
    answers[question.id] = `Sample answer for "${question.questionText}".`;
  }
}

function buildCompletion(): IntakeCompletion {
  const sectionProgress = sections.map((section) => {
    const total = section.questions.length;
    const answered = section.questions.filter((question) => {
      const value = answers[question.id];
      return typeof value === "string" && value.trim().length > 0;
    }).length;
    return {
      sectionId: section.id,
      sectionKey: section.key,
      title: section.title,
      totalQuestions: total,
      answeredQuestions: answered,
      completionPercent: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  });

  const totalQuestions = sectionProgress.reduce((n, s) => n + s.totalQuestions, 0);
  const answeredQuestions = sectionProgress.reduce(
    (n, s) => n + s.answeredQuestions,
    0,
  );

  return {
    totalQuestions,
    answeredQuestions,
    completionPercent:
      totalQuestions > 0
        ? Math.round((answeredQuestions / totalQuestions) * 100)
        : 0,
    sections: sectionProgress,
  };
}

const session: IntakeSession = {
  id: "preview-session",
  brandId: "preview-brand",
  status: "IN_PROGRESS",
  completionPercent: buildCompletion().completionPercent,
  lockedAt: null,
  lockedBy: null,
};

export default function QuestionnaireProgressPreviewPage() {
  // Show the current user sitting inside section 2 — fully answered — so the
  // header bar reflects the whole journey, not just this section.
  const currentSection = sections[1];

  return (
    <SectionQuestionnaire
      allSections={sections}
      answers={answers}
      brandName="Preview Brand"
      completion={buildCompletion()}
      latestSnapshotId={null}
      section={currentSection}
      session={session}
    />
  );
}
