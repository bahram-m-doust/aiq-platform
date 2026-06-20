import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/change-requests/actions", () => ({
  createChangeRequestAction: vi.fn(),
  reviewChangeRequestAction: vi.fn(),
  initialCreateChangeRequestFormState: { status: "idle", message: "" },
  initialReviewChangeRequestFormState: { status: "idle", message: "" },
}));

import { ChangeRequestCreateForm } from "@/features/change-requests/components/ChangeRequestCreateForm";
import { ChangeRequestReviewForm } from "@/features/change-requests/components/ChangeRequestReviewForm";
import {
  canCreateChangeRequestRole,
  canReviewChangeRequestRole,
  targetLabelForRequest,
  toChangeRequestCreatedAudit,
  toChangeRequestStatusAfterAudit,
  validateChangeRequestTargetContext,
  validateCreateChangeRequestFormData,
  validateReviewChangeRequestFormData,
} from "@/features/change-requests/schema";
import type {
  ChangeRequestCreateOptions,
  ChangeRequestRecord,
  ChangeRequestReviewItem,
} from "@/features/change-requests/types";
import type { IntakeQuestion, IntakeSectionWithQuestions } from "@/features/questionnaire/types";
import { formData } from "@/tests/helpers/formData";

const question: IntakeQuestion = {
  id: "question-1",
  sectionId: "section-1",
  key: "COMPANY_POSITION",
  questionText: "What should be corrected?",
  helpText: null,
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
  questions: [question],
};

const options: ChangeRequestCreateOptions = {
  brandId: "brand-1",
  brandName: "Helio",
  membershipRole: "OWNER",
  intakeLocked: true,
  sections: [section],
  modules: [
    {
      id: "module-1",
      title: "Brand Knowledge",
      moduleType: "Brand Knowledge",
      status: "CLIENT_REVIEW",
    },
  ],
};

function request(overrides: Partial<ChangeRequestRecord> = {}): ChangeRequestRecord {
  return {
    id: "request-1",
    brandId: "brand-1",
    targetType: "INTAKE_QUESTION",
    targetId: null,
    sectionKey: "COMPANY",
    questionId: "question-1",
    requestedBy: "profile-1",
    reason: "Market context changed",
    comment: "Please review the positioning answer.",
    status: "REQUESTED",
    reviewedBy: null,
    resolutionNote: null,
    createdAt: "2026-05-16T12:00:00.000Z",
    updatedAt: "2026-05-16T12:00:00.000Z",
    ...overrides,
  };
}

describe("change request validation", () => {
  it("accepts intake question input and requires a comment", () => {
    const result = validateCreateChangeRequestFormData(
      formData({
        target_type: "INTAKE_QUESTION",
        question_target: "COMPANY:question-1",
        reason: "  Market context changed  ",
        comment: "  Please correct the locked answer.  ",
      }),
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      targetType: "INTAKE_QUESTION",
      sectionKey: "COMPANY",
      questionId: "question-1",
      moduleId: null,
      reason: "Market context changed",
      comment: "Please correct the locked answer.",
    });

    // Reason and Comment were merged into a single Comment field, so a legacy
    // Reason value is still parsed when present but is no longer required —
    // only the Comment is mandatory.
    expect(
      validateCreateChangeRequestFormData(
        formData({
          target_type: "MODULE",
          module_id: "module-1",
          reason: "Missing comment",
        }),
      ).error,
    ).toBe("Enter the requested correction details.");
  });

  it("validates review status and role permissions", () => {
    expect(canCreateChangeRequestRole("OWNER")).toBe(true);
    expect(canCreateChangeRequestRole("EXECUTIVE_MANAGER")).toBe(true);
    expect(canCreateChangeRequestRole("BRAND_SPECIALIST")).toBe(false);
    expect(canReviewChangeRequestRole("PLATFORM_OWNER")).toBe(true);
    expect(canReviewChangeRequestRole("SUPERVISOR")).toBe(true);
    expect(canReviewChangeRequestRole("REGISTERED_USER")).toBe(false);

    expect(
      validateReviewChangeRequestFormData(
        formData({
          request_id: "request-1",
          status: "UNDER_REVIEW",
          resolution_note: "Review started",
        }),
      ).data,
    ).toEqual({
      requestId: "request-1",
      status: "UNDER_REVIEW",
      resolutionNote: "Review started",
    });
  });

  it("requires locked intake targets and brand-scoped module targets", () => {
    expect(
      validateChangeRequestTargetContext({
        input: {
          targetType: "INTAKE_SECTION",
          sectionKey: "COMPANY",
          questionId: null,
          moduleId: null,
          reason: "Correction",
          comment: "Please review.",
        },
        context: { ...options, intakeLocked: false },
      }),
    ).toBe(
      "Change Requests are available only after Final Submit locks the questionnaire.",
    );

    expect(
      validateChangeRequestTargetContext({
        input: {
          targetType: "MODULE",
          sectionKey: null,
          questionId: null,
          moduleId: "other-module",
          reason: "Correction",
          comment: "Please review.",
        },
        context: options,
      }),
    ).toBe("Choose a valid brand module.");
  });
});

describe("change request audit and labels", () => {
  it("builds safe audit metadata without duplicating comment text", () => {
    const audit = toChangeRequestCreatedAudit({ request: request() });

    expect(JSON.stringify(audit)).not.toContain(
      "Please review the positioning answer.",
    );
    expect(audit).toMatchObject({
      request_id: "request-1",
      target_type: "INTAKE_QUESTION",
      reason_present: true,
      comment_length: 37,
    });
  });

  it("builds status update audit metadata and target labels", () => {
    const previous = request();
    const next = request({ status: "APPROVED", reviewedBy: "supervisor-1" });

    expect(
      toChangeRequestStatusAfterAudit({
        request: next,
        previousStatus: previous.status,
      }),
    ).toMatchObject({
      previous_status: "REQUESTED",
      status: "APPROVED",
      reviewed_by: "supervisor-1",
    });

    expect(
      targetLabelForRequest({
        request: next,
        sections: [section],
        modules: options.modules,
      }),
    ).toBe("Questionnaire question: What should be corrected?");
  });
});

describe("change request components", () => {
  it("renders the client request form with target options", () => {
    render(<ChangeRequestCreateForm options={options} />);

    expect(screen.getByText("Create Change Request")).toBeVisible();
    expect(screen.getAllByText("Locked questionnaire section")[0]).toBeVisible();
    // Reason and Comment were merged into a single Comment field.
    expect(screen.queryByLabelText("Reason")).toBeNull();
    expect(screen.getByLabelText("Comment")).toBeVisible();
  });

  it("renders the admin review form with review dialog trigger", () => {
    const reviewRequest: ChangeRequestReviewItem = {
      ...request(),
      brandName: "Helio",
      requesterEmail: "owner@example.com",
      reviewerEmail: null,
      targetLabel: "Intake question: What should be corrected?",
    };

    render(<ChangeRequestReviewForm request={reviewRequest} />);

    expect(screen.getAllByText("Requested")[0]).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Review" }),
    ).toBeVisible();
  });
});
