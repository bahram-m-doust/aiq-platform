import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/questionnaire/actions", () => ({
  autosaveIntakeAnswerAction: vi.fn(),
  autosaveIntakeAnswersAction: vi.fn(),
  finalSubmitIntakeAction: vi.fn(),
  initialFinalSubmitIntakeFormState: { status: "idle" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { FinalSubmitReadiness } from "@/features/questionnaire/components/FinalSubmitReadiness";
import { LockedIntakeView } from "@/features/questionnaire/components/LockedIntakeView";
import { QuestionnaireLanding } from "@/features/questionnaire/components/QuestionnaireLanding";
import { QuestionRenderer } from "@/features/questionnaire/components/QuestionRenderer";
import { SectionQuestionnaire } from "@/features/questionnaire/components/SectionQuestionnaire";
import {
  buildIntakeFinalSubmitAfterAudit,
  buildIntakeSnapshotJson,
  calculateIntakeCompletion,
  canAnswerIntakeRole,
  finalSubmitConfirmationCopy,
  isIntakeAnswerComplete,
  normalizeIntakeAnswerValue,
  parseQuestionOptions,
  resolveQuestionInputKind,
  validateFinalSubmitCompletion,
} from "@/features/questionnaire/schemas";
import type {
  IntakeCompletion,
  IntakePageData,
  IntakeQuestion,
  IntakeSession,
  IntakeSectionWithQuestions,
} from "@/features/questionnaire/types";

const question: IntakeQuestion = {
  id: "question-1",
  sectionId: "section-1",
  key: "COMPANY_NAME",
  questionText: "What is the strategic role of the company?",
  helpText: "Use concise executive language.",
  inputType: "textarea",
  isRequired: true,
  orderIndex: 1,
  validationSchema: null,
};

const section: IntakeSectionWithQuestions = {
  id: "section-1",
  key: "COMPANY",
  title: "Company",
  description: null,
  orderIndex: 1,
  isRequired: true,
  questions: [
    question,
    {
      ...question,
      id: "question-2",
      key: "COMPANY_WEBSITE",
      questionText: "What is the company website?",
      inputType: "url",
      orderIndex: 2,
    },
  ],
};

function completion(overrides: Partial<IntakeCompletion> = {}): IntakeCompletion {
  return {
    totalQuestions: 2,
    answeredQuestions: 1,
    completionPercent: 50,
    sections: [
      {
        sectionId: "section-1",
        sectionKey: "COMPANY",
        title: "Company",
        totalQuestions: 2,
        answeredQuestions: 1,
        completionPercent: 50,
      },
    ],
    ...overrides,
  };
}

function session(overrides: Partial<IntakeSession> = {}): IntakeSession {
  return {
    id: "session-1",
    brandId: "brand-1",
    status: "DRAFT",
    completionPercent: 50,
    lockedAt: null,
    lockedBy: null,
    ...overrides,
  };
}

function intakeData(overrides: Partial<IntakePageData> = {}): IntakePageData {
  return {
    access: {
      brandId: "brand-1",
      brandName: "Helio",
      membershipRole: "OWNER",
      planName: "BASIC",
    },
    session: session({
      status: "LOCKED",
      completionPercent: 100,
      lockedAt: "2026-05-16T12:00:00.000Z",
      lockedBy: "profile-1",
    }),
    sections: [section],
    answers: {
      "question-1": "Strategic answer",
      "question-2": "https://helio.example",
    },
    completion: completion({
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
    }),
    latestSnapshotId: null,
    markedDoneQuestionIds: null,
    ...overrides,
  };
}

describe("intake permission and answer rules", () => {
  it("allows only Owner and Executive Manager to answer intake", () => {
    expect(canAnswerIntakeRole("OWNER")).toBe(true);
    expect(canAnswerIntakeRole("EXECUTIVE_MANAGER")).toBe(true);
    expect(canAnswerIntakeRole("BRAND_SPECIALIST")).toBe(false);
    expect(canAnswerIntakeRole(null)).toBe(false);
  });

  it("normalizes answers by input type and detects completion", () => {
    expect(
      normalizeIntakeAnswerValue({ inputType: "text", value: "  Helio  " }),
    ).toBe("Helio");
    expect(
      normalizeIntakeAnswerValue({ inputType: "number", value: "42" }),
    ).toBe(42);
    expect(
      normalizeIntakeAnswerValue({ inputType: "multi_select", value: ["A", ""] }),
    ).toEqual(["A"]);
    expect(
      normalizeIntakeAnswerValue({ inputType: "checkbox", value: "on" }),
    ).toBe(true);

    expect(isIntakeAnswerComplete(null)).toBe(false);
    expect(isIntakeAnswerComplete("")).toBe(false);
    expect(isIntakeAnswerComplete([])).toBe(false);
    expect(isIntakeAnswerComplete(false)).toBe(true);
  });

  it("parses option metadata and resolves supported input kinds", () => {
    expect(
      parseQuestionOptions({
        options: [
          "Enterprise",
          { value: "midmarket", label: "Mid-market" },
          { value: "", label: "Ignored" },
        ],
      }),
    ).toEqual([
      { label: "Enterprise", value: "Enterprise" },
      { label: "Mid-market", value: "midmarket" },
    ]);

    expect(resolveQuestionInputKind("single_choice")).toBe("radio");
    expect(resolveQuestionInputKind("unknown")).toBe("textarea");
  });
});

describe("intake completion", () => {
  it("calculates required section and total progress", () => {
    expect(
      calculateIntakeCompletion({
        sections: [section],
        answers: {
          "question-1": "Clear answer",
          "question-2": null,
        },
      }),
    ).toEqual(completion());
  });

  it("never reports 100% until every question is answered", () => {
    // 199 of 200 answered rounds to 99.5; plain Math.round would report a
    // false 100% and falsely enable Final Submit (the server then rejects it).
    const questions: IntakeQuestion[] = Array.from(
      { length: 200 },
      (_, index) => ({
        ...question,
        id: `q-${index}`,
        key: `Q_${index}`,
        orderIndex: index + 1,
      }),
    );
    const almostAll = Object.fromEntries(
      questions.slice(0, 199).map((item) => [item.id, "Answered"]),
    );

    const partial = calculateIntakeCompletion({
      sections: [{ ...section, questions }],
      answers: almostAll,
    });

    expect(partial.totalQuestions).toBe(200);
    expect(partial.answeredQuestions).toBe(199);
    expect(partial.completionPercent).toBe(99);
    expect(
      validateFinalSubmitCompletion({ session: session(), completion: partial }),
    ).toBe("Final Submit is available only after every question is complete.");

    const everyAnswer = Object.fromEntries(
      questions.map((item) => [item.id, "Answered"]),
    );
    expect(
      calculateIntakeCompletion({
        sections: [{ ...section, questions }],
        answers: everyAnswer,
      }).completionPercent,
    ).toBe(100);
  });

  it("requires 100 percent completion and an unlocked session for final submit", () => {
    expect(
      validateFinalSubmitCompletion({
        session: session(),
        completion: completion(),
      }),
    ).toBe("Final Submit is available only after every question is complete.");

    expect(
      validateFinalSubmitCompletion({
        session: session({
          status: "LOCKED",
          lockedAt: "2026-05-16T12:00:00.000Z",
        }),
        completion: completion({
          answeredQuestions: 2,
          completionPercent: 100,
        }),
      }),
    ).toBe("This questionnaire is already locked.");

    expect(
      validateFinalSubmitCompletion({
        session: session(),
        completion: completion({
          totalQuestions: 0,
          answeredQuestions: 0,
          completionPercent: 0,
        }),
      }),
    ).toBe("The questionnaire question bank is not ready for final submission.");
  });

  it("builds ordered intake snapshots and safe final-submit audit metadata", () => {
    const data = intakeData();
    const snapshot = buildIntakeSnapshotJson({
      access: data.access,
      session: data.session,
      sections: data.sections,
      answers: data.answers,
      completion: data.completion,
      submittedAt: "2026-05-16T12:00:00.000Z",
      submittedBy: "profile-1",
    });

    expect(snapshot).toMatchObject({
      version: 1,
      brand: {
        id: "brand-1",
        name: "Helio",
      },
      session: {
        id: "session-1",
        status: "LOCKED",
        lockedBy: "profile-1",
      },
      sections: [
        {
          key: "COMPANY",
          questions: [
            {
              key: "COMPANY_NAME",
              answer: { value: "Strategic answer" },
            },
            {
              key: "COMPANY_WEBSITE",
              answer: { value: "https://helio.example" },
            },
          ],
        },
      ],
    });

    const audit = buildIntakeFinalSubmitAfterAudit({
      session: data.session,
      snapshotId: "snapshot-1",
      completion: data.completion,
      notification: {
        status: "placeholder",
        channel: "internal_team",
        event: "intake_final_submitted",
        brandId: "brand-1",
        sessionId: "session-1",
        snapshotId: "snapshot-1",
        createdAt: "2026-05-16T12:00:00.000Z",
        delivery: "not_configured",
      },
    });

    expect(JSON.stringify(audit)).not.toContain("Strategic answer");
    expect(audit).not.toHaveProperty("action");
    expect(audit).toMatchObject({
      snapshot_id: "snapshot-1",
      completion_percent: 100,
      internal_notification: {
        status: "placeholder",
        delivery: "not_configured",
      },
    });
  });
});

describe("intake UI components", () => {
  it("renders a question with executive context", () => {
    render(
      <QuestionRenderer
        question={question}
        sessionId="session-1"
        value={null}
      />,
    );

    expect(
      screen.getByLabelText("What is the strategic role of the company?"),
    ).toBeVisible();
    expect(
      screen.getByLabelText("What is the strategic role of the company?"),
    ).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText("Use concise executive language.")).toBeVisible();
  });

  it("marks an empty text area invalid only when validation is requested", () => {
    render(
      <QuestionRenderer
        question={question}
        requiredError
        sessionId="session-1"
        value={null}
      />,
    );

    expect(
      screen.getByLabelText("What is the strategic role of the company?"),
    ).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("This question needs an answer.")).toBeVisible();
  });

  it("collapses an answered question to read-only with an Edit affordance", async () => {
    const user = userEvent.setup();
    render(
      <QuestionRenderer
        autosaveAction={vi.fn()}
        question={question}
        sessionId="session-1"
        value="An existing answer"
      />,
    );

    expect(screen.getByText("An existing answer")).toBeVisible();
    expect(screen.getByText("Completed")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Edit/ }));

    expect(screen.getByRole("textbox")).toBeVisible();
  });

  it("disables done for an empty required answer", () => {
    render(
      <QuestionRenderer
        autosaveAction={vi.fn()}
        question={question}
        sessionId="session-1"
        value={null}
      />,
    );

    expect(screen.getByRole("textbox")).toBeVisible();
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Edit/ }),
    ).not.toBeInTheDocument();
  });

  it("hides a stale saved status after a saved required answer is cleared", async () => {
    const user = userEvent.setup();
    render(
      <QuestionRenderer
        onQueuedChange={vi.fn()}
        question={question}
        saveState={{ status: "saved", message: "" }}
        sessionId="session-1"
        value="Previously saved answer"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Edit/ }));
    await user.clear(
      screen.getByLabelText("What is the strategic role of the company?"),
    );

    expect(screen.queryByText("Draft saved")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
  });

  it("enables save and mark done once a required text answer is filled", async () => {
    const user = userEvent.setup();
    const autosave = vi.fn().mockResolvedValue({
      ok: true,
      questionId: "question-1",
      value: "A considered answer",
      completionPercent: 50,
    });
    render(
      <QuestionRenderer
        autosaveAction={autosave}
        question={question}
        sessionId="session-1"
        value={null}
      />,
    );

    const field = screen.getByLabelText(
      "What is the strategic role of the company?",
    );
    await user.type(field, "A considered answer");

    const markDone = screen.getByRole("button", { name: /Save & mark done/ });
    expect(markDone).toBeEnabled();

    await user.click(markDone);

    expect(autosave).toHaveBeenCalledWith({
      sessionId: "session-1",
      questionId: "question-1",
      value: "A considered answer",
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/ })).toBeVisible();
  });

  it("does not autosave a free-text field on blur when nothing changed", async () => {
    const user = userEvent.setup();
    const autosave = vi.fn();
    render(
      <QuestionRenderer
        autosaveAction={autosave}
        question={question}
        sessionId="session-1"
        value={null}
      />,
    );

    const field = screen.getByLabelText(
      "What is the strategic role of the company?",
    );
    await user.click(field);
    await user.tab();

    expect(autosave).not.toHaveBeenCalled();
  });

  it("autosaves a free-text field on blur after a real change", async () => {
    const user = userEvent.setup();
    const autosave = vi.fn().mockResolvedValue({
      ok: true,
      questionId: "question-1",
      value: "A considered answer",
      completionPercent: 50,
    });
    render(
      <QuestionRenderer
        autosaveAction={autosave}
        question={question}
        sessionId="session-1"
        value={null}
      />,
    );

    const field = screen.getByLabelText(
      "What is the strategic role of the company?",
    );
    await user.click(field);
    await user.type(field, "A considered answer");
    await user.tab();

    expect(autosave).toHaveBeenCalledWith({
      sessionId: "session-1",
      questionId: "question-1",
      value: "A considered answer",
    });
  });

  it("hides Submit below 100 percent and shows at 100", () => {
    const { rerender, container } = render(
      <FinalSubmitReadiness completion={completion()} sessionId="session-1" />,
    );

    expect(container.querySelector("button")).toBeNull();

    rerender(
      <FinalSubmitReadiness
        completion={completion({
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
        })}
        sessionId="session-1"
      />,
    );

    expect(
      screen.getByRole("button", { name: /Approve & Lock/ }),
    ).toBeEnabled();
  });

  it("shows the final submit confirmation copy in the modal", async () => {
    const user = userEvent.setup();
    render(
      <FinalSubmitReadiness
        completion={completion({
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
        })}
        sessionId="session-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Approve & Lock/ }));

    expect(screen.getByText(finalSubmitConfirmationCopy)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirm" }),
    ).toBeVisible();
  });

  it("hides the approve button for non-owners and shows an awaiting note", () => {
    render(
      <FinalSubmitReadiness
        canApprove={false}
        completion={completion({
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
        })}
        sessionId="session-1"
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Approve & Lock/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/awaiting your brand/i)).toBeVisible();
  });

  it("renders locked intake answers without editable controls", () => {
    render(
      <LockedIntakeView data={intakeData()} selectedSectionKey="COMPANY" />,
    );

    expect(screen.getByText("Strategic Questionnaire is locked")).toBeVisible();
    expect(screen.getByText("Strategic answer")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Request a Change" }),
    ).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Final Submit" }),
    ).not.toBeInTheDocument();
  });

  it("shows the unanswered warning on the overview even before review", () => {
    const data = intakeData({
      session: session(),
      answers: {
        "question-1": "Strategic answer",
        "question-2": null,
      },
      completion: completion(),
    });
    const { container } = render(<QuestionnaireLanding data={data} />);

    // Section list cards link plainly (no validation flag).
    expect(
      container.querySelector(
        'a[href="/integrated-brand-brain/roadmap/questionnaire/company"]',
      ),
    ).not.toBeNull();
    // The Unanswered warning box is always visible (no review step needed) and
    // links into validation mode.
    expect(
      container.querySelector(
        'a[href="/integrated-brand-brain/roadmap/questionnaire/company?validate=1"]',
      ),
    ).not.toBeNull();
    expect(screen.getByText(/not marked done yet/i)).toBeVisible();
  });

  it("treats answered-but-not-marked-done questions as unanswered", () => {
    const data = intakeData({
      session: session(),
      answers: {
        "question-1": "Strategic answer",
        "question-2": "https://helio.example",
      },
      completion: completion({
        answeredQuestions: 2,
        completionPercent: 100,
      }),
      // Both questions have a value, but neither has been "Save & mark done"-ed.
      markedDoneQuestionIds: [],
    });
    render(<QuestionnaireLanding data={data} showSubmitReview />);

    expect(screen.getByText(/not marked done yet/i)).toBeVisible();
  });

  it("clears the unanswered warning once every question is marked done", () => {
    const data = intakeData({
      session: session(),
      answers: {
        "question-1": "Strategic answer",
        "question-2": "https://helio.example",
      },
      completion: completion({
        answeredQuestions: 2,
        completionPercent: 100,
      }),
      markedDoneQuestionIds: ["question-1", "question-2"],
    });
    render(<QuestionnaireLanding data={data} />);

    expect(screen.queryByText(/not marked done yet/i)).not.toBeInTheDocument();
  });

  it("shows approve and lock only after review submit when complete", () => {
    const data = intakeData({
      session: session(),
      answers: {
        "question-1": "Strategic answer",
        "question-2": "https://helio.example",
      },
      completion: completion({
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
      }),
    });
    const { rerender } = render(<QuestionnaireLanding data={data} />);

    expect(
      screen.queryByRole("button", { name: /Approve & Lock/ }),
    ).not.toBeInTheDocument();

    rerender(<QuestionnaireLanding data={data} showSubmitReview />);

    expect(
      screen.getByRole("button", { name: /Approve & Lock/ }),
    ).toBeEnabled();
  });

  it("does not validate unanswered fields when moving between sections", () => {
    const nextSection: IntakeSectionWithQuestions = {
      ...section,
      id: "section-2",
      key: "AUDIENCE",
      title: "Audience",
      orderIndex: 2,
      questions: [
        {
          ...question,
          id: "question-3",
          key: "AUDIENCE_CONTEXT",
          questionText: "Who is the audience?",
        },
      ],
    };

    const { container } = render(
      <SectionQuestionnaire
        allSections={[section, nextSection]}
        answers={{
          "question-1": "Strategic answer",
          "question-2": null,
          "question-3": null,
        }}
        brandName="Helio"
        completion={completion()}
        section={section}
        session={session()}
      />,
    );

    expect(
      container.querySelector(
        'a[href="/integrated-brand-brain/roadmap/questionnaire/audience"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'a[href="/integrated-brand-brain/roadmap/questionnaire/audience?validate=1"]',
      ),
    ).toBeNull();
  });

  it("shows section completion counts in questionnaire tabs", () => {
    const nextSection: IntakeSectionWithQuestions = {
      ...section,
      id: "section-2",
      key: "AUDIENCE",
      title: "Audience",
      orderIndex: 2,
      questions: [
        {
          ...question,
          id: "question-3",
          key: "AUDIENCE_CONTEXT",
          questionText: "Who is the audience?",
        },
      ],
    };

    render(
      <SectionQuestionnaire
        allSections={[section, nextSection]}
        answers={{
          "question-1": "Strategic answer",
          "question-2": null,
          "question-3": null,
        }}
        brandName="Helio"
        completion={completion()}
        section={section}
        session={session()}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Company\s+1\/2/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Audience\s+0\/1/ }),
    ).toBeVisible();
  });

  it("routes review and submit from the last section into submit review mode", () => {
    render(
      <SectionQuestionnaire
        allSections={[section]}
        answers={{
          "question-1": "Strategic answer",
          "question-2": "https://helio.example",
        }}
        brandName="Helio"
        completion={completion({
          answeredQuestions: 2,
          completionPercent: 100,
        })}
        section={section}
        session={session()}
      />,
    );

    expect(screen.getByRole("link", { name: /Review & submit/ })).toHaveAttribute(
      "href",
      "/integrated-brand-brain/roadmap/questionnaire?review=1",
    );
  });
});
