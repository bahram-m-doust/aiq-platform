export const intakeBuilderQuestionInputTypes = [
  "text",
  "textarea",
  "url",
  "number",
  "select",
  "radio",
  "checkbox",
  "multi_select",
] as const;

export type IntakeBuilderQuestionInputType =
  (typeof intakeBuilderQuestionInputTypes)[number];

export type IntakeBuilderQuestionOption = {
  label: string;
  value: string;
};

export type IntakeBuilderQuestion = {
  id: string;
  sectionId: string;
  key: string;
  questionText: string;
  helpText: string | null;
  inputType: IntakeBuilderQuestionInputType;
  isRequired: boolean;
  isActive: boolean;
  orderIndex: number;
  validationSchema: unknown;
  createdAt: string | null;
  updatedAt: string | null;
};

export type IntakeBuilderSection = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  isActive: boolean;
  orderIndex: number;
  createdAt: string | null;
  updatedAt: string | null;
  questions: IntakeBuilderQuestion[];
};

export type IntakeBuilderData = {
  sections: IntakeBuilderSection[];
};

export type IntakeBuilderFormState =
  | {
      status: "idle";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "success";
      message: string;
    };

export type ParsedSectionFormInput = {
  sectionId?: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  orderIndex: number | null;
};

export type ParsedQuestionFormInput = {
  questionId?: string;
  sectionId: string;
  questionText: string;
  helpText: string | null;
  inputType: IntakeBuilderQuestionInputType;
  isRequired: boolean;
  orderIndex: number | null;
  options: IntakeBuilderQuestionOption[];
};

export type ReorderDirection = "up" | "down";
