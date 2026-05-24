import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/intake-builder/actions", () => ({
  archiveIntakeQuestionAction: vi.fn(async () => ({ status: "success" })),
  archiveIntakeSectionAction: vi.fn(async () => ({ status: "success" })),
  createIntakeQuestionAction: vi.fn(async () => ({ status: "success" })),
  createIntakeSectionAction: vi.fn(async () => ({ status: "success" })),
  reorderIntakeQuestionAction: vi.fn(async () => ({ status: "success" })),
  reorderIntakeSectionAction: vi.fn(async () => ({ status: "success" })),
  unarchiveIntakeQuestionAction: vi.fn(async () => ({ status: "success" })),
  unarchiveIntakeSectionAction: vi.fn(async () => ({ status: "success" })),
  updateIntakeQuestionAction: vi.fn(async () => ({ status: "success" })),
  updateIntakeSectionAction: vi.fn(async () => ({ status: "success" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { IntakeBuilderWorkspace } from "@/features/admin/intake-builder/components/IntakeBuilderWorkspace";
import {
  buildUniqueTechnicalKey,
  optionsTextFromValidationSchema,
  parseQuestionOptionsText,
  validateQuestionFormData,
  validateSectionFormData,
  validationSchemaFromOptions,
} from "@/features/admin/intake-builder/schema";
import type { IntakeBuilderSection } from "@/features/admin/intake-builder/types";
import { getIntakeSectionsWithQuestions } from "@/features/intake/queries";
import { auditActions } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";
import { formData } from "@/tests/helpers/formData";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver =
  globalThis.ResizeObserver ?? (ResizeObserverMock as typeof ResizeObserver);

function section(overrides: Partial<IntakeBuilderSection> = {}): IntakeBuilderSection {
  return {
    id: "section-1",
    key: "COMPANY",
    title: "Company",
    description: "Company context",
    isRequired: true,
    isActive: true,
    orderIndex: 1,
    createdAt: "2026-05-20T08:00:00.000Z",
    updatedAt: "2026-05-20T08:00:00.000Z",
    questions: [
      {
        id: "question-1",
        sectionId: "section-1",
        key: "COMPANY_NAME",
        questionText: "What is the company name?",
        helpText: "Use the registered brand name.",
        inputType: "text",
        isRequired: true,
        isActive: true,
        orderIndex: 1,
        validationSchema: {},
        createdAt: "2026-05-20T08:00:00.000Z",
        updatedAt: "2026-05-20T08:00:00.000Z",
      },
      {
        id: "question-2",
        sectionId: "section-1",
        key: "COMPANY_ARCHIVED",
        questionText: "Archived question",
        helpText: null,
        inputType: "textarea",
        isRequired: true,
        isActive: false,
        orderIndex: 2,
        validationSchema: {},
        createdAt: "2026-05-20T08:00:00.000Z",
        updatedAt: "2026-05-20T08:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function setupThenableResult(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: vi.fn((resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
    ),
  };

  return chain;
}

describe("admin intake builder validation", () => {
  it("generates stable unique technical keys without changing display titles", () => {
    expect(
      buildUniqueTechnicalKey({
        value: "Style / Tone of Voice",
        fallback: "SECTION",
        existingKeys: [],
      }),
    ).toBe("STYLE_TONE_OF_VOICE");

    expect(
      buildUniqueTechnicalKey({
        value: "Company",
        fallback: "SECTION",
        existingKeys: ["COMPANY", "COMPANY_2"],
      }),
    ).toBe("COMPANY_3");
  });

  it("validates section fields and preserves nullable descriptions", () => {
    const result = validateSectionFormData(
      formData({
        title: "Company",
        description: "",
        order_index: "3",
        is_required: "true",
      }),
    );

    expect(result.data).toMatchObject({
      title: "Company",
      description: null,
      isRequired: true,
      orderIndex: 3,
    });
  });

  it("parses choice options and stores them in validation schema", () => {
    const options = parseQuestionOptionsText("Enterprise\nMid-market\nEnterprise");

    expect(options).toEqual([
      { label: "Enterprise", value: "Enterprise" },
      { label: "Mid-market", value: "Mid-market" },
    ]);
    expect(
      validationSchemaFromOptions({
        inputType: "select",
        options,
      }),
    ).toEqual({ options });
    expect(optionsTextFromValidationSchema({ options })).toBe(
      "Enterprise\nMid-market",
    );
  });

  it("requires options for select, radio, and multi-select questions", () => {
    const result = validateQuestionFormData(
      formData({
        section_id: "section-1",
        question_text: "Choose a market segment",
        input_type: "select",
        options: "Enterprise",
        is_required: "true",
      }),
    );

    expect(result.error).toBe(
      "Select, radio, and multi-select questions require at least two options.",
    );
  });
});

describe("admin intake builder query and audit behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads client intake sections and questions with active-only filters", async () => {
    const sectionsChain = setupThenableResult({
      data: [
        {
          id: "section-1",
          key: "COMPANY",
          title: "Company",
          description: null,
          order_index: 1,
          is_required: true,
        },
      ],
      error: null,
    });
    const questionsChain = setupThenableResult({
      data: [
        {
          id: "question-1",
          section_id: "section-1",
          key: "COMPANY_NAME",
          question_text: "What is the company name?",
          help_text: null,
          input_type: "text",
          is_required: true,
          order_index: 1,
          validation_schema: {},
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "question_sections") {
        return sectionsChain;
      }

      if (table === "questions") {
        return questionsChain;
      }

      throw new Error(`Unexpected table ${table}`);
    });

    mockedCreateAdminClient.mockReturnValue({ from } as never);

    const sections = await getIntakeSectionsWithQuestions();

    expect(sectionsChain.eq).toHaveBeenCalledWith("is_active", true);
    expect(questionsChain.eq).toHaveBeenCalledWith("is_active", true);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.questions).toHaveLength(1);
  });

  it("registers scoped audit actions for builder mutations", () => {
    expect(auditActions).toEqual(
      expect.arrayContaining([
        "intake_section_created",
        "intake_section_updated",
        "intake_section_archived",
        "intake_section_deleted",
        "intake_question_created",
        "intake_question_updated",
        "intake_question_archived",
        "intake_question_deleted",
        "intake_question_reordered",
      ]),
    );
  });
});

describe("admin intake builder UI", () => {
  it("renders add/edit/archive/delete controls", () => {
    render(<IntakeBuilderWorkspace sections={[section()]} />);

    expect(screen.getAllByText("Add section")[0]).toBeVisible();
    expect(screen.getByText("Company")).toBeVisible();
    expect(screen.getByText("What is the company name?")).toBeVisible();
    expect(screen.getByText("Archived question")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /archive section/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /delete section/i }),
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^delete$/i }).length).toBeGreaterThanOrEqual(1);
  });
});
