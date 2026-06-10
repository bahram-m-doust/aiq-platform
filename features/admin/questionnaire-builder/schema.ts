import {
  intakeBuilderQuestionInputTypes,
  type IntakeBuilderFormState,
  type IntakeBuilderQuestionInputType,
  type IntakeBuilderQuestionOption,
  type ParsedQuestionFormInput,
  type ParsedSectionFormInput,
  type ReorderDirection,
} from "@/features/admin/questionnaire-builder/types";

export const initialIntakeBuilderFormState: IntakeBuilderFormState = {
  status: "idle",
};

const optionBasedInputTypes = new Set<IntakeBuilderQuestionInputType>([
  "select",
  "radio",
  "multi_select",
]);

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(formData: FormData, key: string) {
  const value = readString(formData, key);

  return value.length > 0 ? value : null;
}

function readBoolean(formData: FormData, key: string) {
  const value = formData.get(key);

  return value === "true" || value === "on";
}

function readPositiveInteger(formData: FormData, key: string) {
  const raw = readString(formData, key);

  if (!raw) {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function trimForKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
}

export function buildTechnicalKeyBase(value: string, fallback: string) {
  const normalized = trimForKey(value).slice(0, 72).replace(/_+$/g, "");

  return normalized || fallback;
}

export function buildUniqueTechnicalKey({
  value,
  fallback,
  existingKeys,
}: {
  value: string;
  fallback: string;
  existingKeys: string[];
}) {
  const existing = new Set(existingKeys.map((key) => key.toUpperCase()));
  const base = buildTechnicalKeyBase(value, fallback);

  if (!existing.has(base)) {
    return base;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}_${suffix}`;

    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return `${base}_${Date.now()}`;
}

export function isOptionBasedInputType(inputType: string) {
  return optionBasedInputTypes.has(inputType as IntakeBuilderQuestionInputType);
}

export function parseQuestionOptionsText(
  value: string,
): IntakeBuilderQuestionOption[] {
  const seen = new Set<string>();

  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<IntakeBuilderQuestionOption[]>((options, label) => {
      const normalized = label.toLowerCase();

      if (seen.has(normalized)) {
        return options;
      }

      seen.add(normalized);
      options.push({ label, value: label });
      return options;
    }, []);
}

export function optionsTextFromValidationSchema(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const options = (value as { options?: unknown }).options;

  if (!Array.isArray(options)) {
    return "";
  }

  return options
    .map((option) => {
      if (typeof option === "string") {
        return option.trim();
      }

      if (!option || typeof option !== "object" || Array.isArray(option)) {
        return "";
      }

      const record = option as { label?: unknown; value?: unknown };
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const optionValue =
        typeof record.value === "string" ? record.value.trim() : "";

      return label || optionValue;
    })
    .filter(Boolean)
    .join("\n");
}

export function validationSchemaFromOptions({
  inputType,
  options,
}: {
  inputType: IntakeBuilderQuestionInputType;
  options: IntakeBuilderQuestionOption[];
}) {
  if (!optionBasedInputTypes.has(inputType)) {
    return {};
  }

  return { options };
}

export function validateSectionFormData(formData: FormData):
  | {
      data: ParsedSectionFormInput;
      error?: never;
    }
  | {
      data?: never;
      error: string;
    } {
  const sectionId = readString(formData, "section_id") || undefined;
  const title = readString(formData, "title");
  const description = readNullableString(formData, "description");
  const orderIndex = readPositiveInteger(formData, "order_index");

  if (title.length < 2 || title.length > 120) {
    return { error: "Section title must be between 2 and 120 characters." };
  }

  if (description && description.length > 1000) {
    return { error: "Section description must be 1000 characters or less." };
  }

  return {
    data: {
      ...(sectionId ? { sectionId } : {}),
      title,
      description,
      isRequired: readBoolean(formData, "is_required"),
      orderIndex,
    },
  };
}

export function validateQuestionFormData(formData: FormData):
  | {
      data: ParsedQuestionFormInput;
      error?: never;
    }
  | {
      data?: never;
      error: string;
    } {
  const questionId = readString(formData, "question_id") || undefined;
  const sectionId = readString(formData, "section_id");
  const questionText = readString(formData, "question_text");
  const helpText = readNullableString(formData, "help_text");
  const inputType = readString(formData, "input_type");
  const orderIndex = readPositiveInteger(formData, "order_index");

  if (!sectionId) {
    return { error: "Choose a section for the question." };
  }

  if (questionText.length < 2 || questionText.length > 240) {
    return { error: "Question text must be between 2 and 240 characters." };
  }

  if (helpText && helpText.length > 1000) {
    return { error: "Question help text must be 1000 characters or less." };
  }

  if (
    !intakeBuilderQuestionInputTypes.includes(
      inputType as IntakeBuilderQuestionInputType,
    )
  ) {
    return { error: "Choose a supported input type." };
  }

  const typedInputType = inputType as IntakeBuilderQuestionInputType;
  const options = parseQuestionOptionsText(readString(formData, "options"));

  if (optionBasedInputTypes.has(typedInputType) && options.length < 2) {
    return {
      error:
        "Select, radio, and multi-select questions require at least two options.",
    };
  }

  return {
    data: {
      ...(questionId ? { questionId } : {}),
      sectionId,
      questionText,
      helpText,
      inputType: typedInputType,
      isRequired: readBoolean(formData, "is_required"),
      orderIndex,
      options,
    },
  };
}

export function validateIdFormData(
  formData: FormData,
  key: string,
):
  | {
      id: string;
      error?: never;
    }
  | {
      id?: never;
      error: string;
    } {
  const id = readString(formData, key);

  if (!id) {
    return { error: "Missing record identifier." };
  }

  return { id };
}

export function validateReorderFormData(formData: FormData):
  | {
      id: string;
      direction: ReorderDirection;
      error?: never;
    }
  | {
      id?: never;
      direction?: never;
      error: string;
    } {
  const id = readString(formData, "id");
  const direction = readString(formData, "direction");

  if (!id) {
    return { error: "Missing record identifier." };
  }

  if (direction !== "up" && direction !== "down") {
    return { error: "Choose a valid reorder direction." };
  }

  return { id, direction };
}
