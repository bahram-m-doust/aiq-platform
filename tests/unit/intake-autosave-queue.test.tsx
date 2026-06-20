import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/questionnaire/actions", () => ({
  autosaveIntakeAnswerAction: vi.fn(),
  autosaveIntakeAnswersAction: vi.fn(),
  finalSubmitIntakeAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { FinalSubmitReadiness } from "@/features/questionnaire/components/FinalSubmitReadiness";
import { SectionQuestionnaire } from "@/features/questionnaire/components/SectionQuestionnaire";
import { autosaveIntakeAnswersAction } from "@/features/questionnaire/actions";
import type {
  IntakeCompletion,
  IntakeSectionWithQuestions,
  IntakeSession,
} from "@/features/questionnaire/types";

const mockedAutosaveIntakeAnswersAction = vi.mocked(
  autosaveIntakeAnswersAction,
);

const section: IntakeSectionWithQuestions = {
  id: "section-1",
  key: "COMPANY",
  title: "Company",
  description: null,
  orderIndex: 1,
  isRequired: true,
  questions: [
    {
      id: "question-1",
      sectionId: "section-1",
      key: "COMPANY_OVERVIEW",
      questionText: "Company overview",
      helpText: null,
      inputType: "textarea",
      isRequired: true,
      orderIndex: 1,
      validationSchema: null,
    },
    {
      id: "question-2",
      sectionId: "section-1",
      key: "CORE_VALUES",
      questionText: "Core values",
      helpText: null,
      inputType: "textarea",
      isRequired: true,
      orderIndex: 2,
      validationSchema: null,
    },
  ],
};

const session: IntakeSession = {
  id: "session-1",
  brandId: "brand-1",
  status: "DRAFT",
  completionPercent: 0,
  lockedAt: null,
  lockedBy: null,
};

const completion: IntakeCompletion = {
  totalQuestions: 2,
  answeredQuestions: 2,
  completionPercent: 100,
  sections: [
    {
      sectionId: "section-1",
      sectionKey: "COMPANY",
      title: "Company",
      totalQuestions: 2,
      answeredQuestions: 2,
      completionPercent: 100,
    },
  ],
};

function renderQuestionnaire({
  answers = {},
}: {
  answers?: Record<string, string | number | boolean | string[] | null>;
} = {}) {
  return render(
    <SectionQuestionnaire
      allSections={[section]}
      answers={answers}
      brandName="Helio"
      completion={{
        ...completion,
        answeredQuestions: 0,
        completionPercent: 0,
      }}
      section={section}
      session={session}
    />,
  );
}

async function flushAutosaveTimers(ms = 350) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("intake autosave queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.clearAllMocks();
    mockedAutosaveIntakeAnswersAction.mockImplementation(async (input) => ({
      ok: true,
      answers: input.answers.map((answer) => ({
        questionId: answer.questionId,
        value: answer.value as never,
      })),
      completionPercent: 100,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("does not save while typing and commits each field on blur", async () => {
    renderQuestionnaire();

    const overview = screen.getByLabelText("Company overview");
    fireEvent.focus(overview);
    fireEvent.change(overview, { target: { value: "First draft" } });

    // Typing alone never triggers a save, even past the debounce window.
    await flushAutosaveTimers();
    expect(mockedAutosaveIntakeAnswersAction).not.toHaveBeenCalled();
    expect(screen.queryByText("Saving...")).not.toBeInTheDocument();

    // Blurring the field commits it.
    fireEvent.blur(overview);
    await flushAutosaveTimers(0);

    expect(mockedAutosaveIntakeAnswersAction).toHaveBeenCalledTimes(1);
    expect(mockedAutosaveIntakeAnswersAction).toHaveBeenLastCalledWith({
      sessionId: "session-1",
      answers: [{ questionId: "question-1", value: "First draft" }],
    });

    // A second field commits on its own blur.
    const values = screen.getByLabelText("Core values");
    fireEvent.focus(values);
    fireEvent.change(values, { target: { value: "Clarity" } });
    fireEvent.blur(values);
    await flushAutosaveTimers(0);

    expect(mockedAutosaveIntakeAnswersAction).toHaveBeenCalledTimes(2);
    expect(mockedAutosaveIntakeAnswersAction).toHaveBeenLastCalledWith({
      sessionId: "session-1",
      answers: [{ questionId: "question-2", value: "Clarity" }],
    });
  });

  it("does not autosave when an untouched empty field blurs", async () => {
    renderQuestionnaire();

    const field = screen.getByLabelText("Company overview");
    fireEvent.focus(field);
    fireEvent.blur(field);

    await flushAutosaveTimers();

    expect(mockedAutosaveIntakeAnswersAction).not.toHaveBeenCalled();
    expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
    expect(screen.queryByText("Draft saved")).not.toBeInTheDocument();
  });

  it("cancels a pending save when the answer returns to the committed value", async () => {
    renderQuestionnaire({
      answers: {
        "question-1": "Original",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Company overview"), {
      target: { value: "Changed" },
    });
    fireEvent.change(screen.getByLabelText("Company overview"), {
      target: { value: "Original" },
    });

    await flushAutosaveTimers();

    expect(mockedAutosaveIntakeAnswersAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Company overview")).toHaveValue("Original");
    expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
  });

  it("commits only the final typed value of a field on blur", async () => {
    renderQuestionnaire();

    const field = screen.getByLabelText("Company overview");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "First" } });
    fireEvent.change(field, { target: { value: "Final" } });

    await flushAutosaveTimers();
    expect(mockedAutosaveIntakeAnswersAction).not.toHaveBeenCalled();

    fireEvent.blur(field);
    await flushAutosaveTimers(0);

    expect(mockedAutosaveIntakeAnswersAction).toHaveBeenCalledTimes(1);
    expect(mockedAutosaveIntakeAnswersAction).toHaveBeenCalledWith({
      sessionId: "session-1",
      answers: [{ questionId: "question-1", value: "Final" }],
    });
  });

  it("keeps failed drafts retryable", async () => {
    mockedAutosaveIntakeAnswersAction
      .mockResolvedValueOnce({
        ok: false,
        message: "The answer could not be saved.",
        failedQuestionIds: ["question-1"],
      })
      .mockImplementationOnce(async (input) => ({
        ok: true,
        answers: input.answers.map((answer) => ({
          questionId: answer.questionId,
          value: answer.value as never,
        })),
        completionPercent: 50,
      }));

    renderQuestionnaire();

    const field = screen.getByLabelText("Company overview");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "Retry me" } });
    fireEvent.blur(field);

    await flushAutosaveTimers(0);
    const retry = screen.getByRole("button", {
      name: "The answer could not be saved.",
    });
    fireEvent.click(retry);

    expect(mockedAutosaveIntakeAnswersAction).toHaveBeenCalledTimes(2);
    expect(mockedAutosaveIntakeAnswersAction).toHaveBeenLastCalledWith({
      sessionId: "session-1",
      answers: [{ questionId: "question-1", value: "Retry me" }],
    });
  });

  it("restores an unsent local draft and flushes it on mount", async () => {
    window.localStorage.setItem(
      "bextudio:intake-autosave:session-1",
      JSON.stringify([{ questionId: "question-1", value: "Restored draft" }]),
    );

    renderQuestionnaire();

    expect(screen.getByLabelText("Company overview")).toHaveValue(
      "Restored draft",
    );

    await flushAutosaveTimers(0);

    expect(mockedAutosaveIntakeAnswersAction).toHaveBeenCalledWith({
      sessionId: "session-1",
      answers: [{ questionId: "question-1", value: "Restored draft" }],
    });
  });

  it("can disable final submit while a save is still pending", () => {
    render(
      <FinalSubmitReadiness
        completion={completion}
        disabled
        sessionId="session-1"
      />,
    );

    expect(
      screen.getByRole("button", { name: /Approve & Lock/ }),
    ).toBeDisabled();
  });
});
