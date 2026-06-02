import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/intake/actions", () => ({
  autosaveIntakeAnswerAction: vi.fn(),
  finalSubmitIntakeAction: vi.fn(),
  initialFinalSubmitIntakeFormState: { status: "idle" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { FinalSubmitReadiness } from "@/features/intake/components/FinalSubmitReadiness";
import { LockedIntakeView } from "@/features/intake/components/LockedIntakeView";
import { QuestionRenderer } from "@/features/intake/components/QuestionRenderer";
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
} from "@/features/intake/schemas";
import type {
  IntakeCompletion,
  IntakePageData,
  IntakeQuestion,
  IntakeSession,
  IntakeSectionWithQuestions,
} from "@/features/intake/types";

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
    ).toBe("This intake session is already locked.");

    expect(
      validateFinalSubmitCompletion({
        session: session(),
        completion: completion({
          totalQuestions: 0,
          answeredQuestions: 0,
          completionPercent: 0,
        }),
      }),
    ).toBe("The intake question bank is not ready for final submission.");
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
  it("renders a question with required executive context", () => {
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
    expect(screen.getByText("Required")).toBeVisible();
    expect(screen.getByText("Use concise executive language.")).toBeVisible();
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

    expect(screen.getByText("Strategic Intake is locked")).toBeVisible();
    expect(screen.getByText("Strategic answer")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Create Change Request" }),
    ).toHaveAttribute("href", "/dashboard/change-requests");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Final Submit" }),
    ).not.toBeInTheDocument();
  });
});
