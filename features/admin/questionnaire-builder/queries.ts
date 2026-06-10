import "server-only";

import {
  intakeBuilderQuestionInputTypes,
  type IntakeBuilderData,
  type IntakeBuilderQuestion,
  type IntakeBuilderQuestionInputType,
  type IntakeBuilderSection,
} from "@/features/admin/questionnaire-builder/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type IntakeBuilderSectionRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  order_index: number;
  is_required: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type IntakeBuilderQuestionRow = {
  id: string;
  section_id: string;
  key: string;
  question_text: string;
  help_text: string | null;
  input_type: string;
  is_required: boolean | null;
  is_active: boolean | null;
  order_index: number;
  validation_schema: unknown;
  created_at: string | null;
  updated_at: string | null;
};

const sectionColumns = [
  "id",
  "key",
  "title",
  "description",
  "order_index",
  "is_required",
  "is_active",
  "created_at",
  "updated_at",
].join(", ");

const questionColumns = [
  "id",
  "section_id",
  "key",
  "question_text",
  "help_text",
  "input_type",
  "is_required",
  "is_active",
  "order_index",
  "validation_schema",
  "created_at",
  "updated_at",
].join(", ");

export function isMissingIntakeBuilderMigrationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const message = typeof record.message === "string" ? record.message : "";

  return (
    record.code === "42703" &&
    (message.includes("is_active") || message.includes("updated_at"))
  );
}

function isSupportedInputType(value: string): value is IntakeBuilderQuestionInputType {
  return intakeBuilderQuestionInputTypes.includes(
    value as IntakeBuilderQuestionInputType,
  );
}

export function toIntakeBuilderSection(
  row: IntakeBuilderSectionRow,
): Omit<IntakeBuilderSection, "questions"> {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    orderIndex: row.order_index,
    isRequired: row.is_required ?? true,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toIntakeBuilderQuestion(
  row: IntakeBuilderQuestionRow,
): IntakeBuilderQuestion {
  return {
    id: row.id,
    sectionId: row.section_id,
    key: row.key,
    questionText: row.question_text,
    helpText: row.help_text,
    inputType: isSupportedInputType(row.input_type) ? row.input_type : "textarea",
    isRequired: row.is_required ?? true,
    isActive: row.is_active ?? true,
    orderIndex: row.order_index,
    validationSchema: row.validation_schema,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getIntakeBuilderData(): Promise<IntakeBuilderData> {
  const admin = createAdminClient();
  const [sectionsResult, questionsResult] = await Promise.all([
    admin
      .from("question_sections")
      .select(sectionColumns)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("questions")
      .select(questionColumns)
      .order("section_id", { ascending: true })
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (sectionsResult.error) {
    throw sectionsResult.error;
  }

  if (questionsResult.error) {
    throw questionsResult.error;
  }

  const questions = (
    ((questionsResult.data ?? []) as unknown) as IntakeBuilderQuestionRow[]
  ).map(toIntakeBuilderQuestion);

  return {
    sections: (
      ((sectionsResult.data ?? []) as unknown) as IntakeBuilderSectionRow[]
    ).map((section): IntakeBuilderSection => {
      const builderSection = toIntakeBuilderSection(section);

      return {
        ...builderSection,
        questions: questions.filter(
          (question) => question.sectionId === builderSection.id,
        ),
      };
    }),
  };
}

export async function getIntakeBuilderSectionById(sectionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("question_sections")
    .select(sectionColumns)
    .eq("id", sectionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? toIntakeBuilderSection((data as unknown) as IntakeBuilderSectionRow)
    : null;
}

export async function getIntakeBuilderQuestionById(questionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("questions")
    .select(questionColumns)
    .eq("id", questionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? toIntakeBuilderQuestion((data as unknown) as IntakeBuilderQuestionRow)
    : null;
}

export async function getExistingIntakeSectionKeys() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("question_sections").select("key");

  if (error) {
    throw error;
  }

  return ((data ?? []) as { key: string }[]).map((row) => row.key);
}

export async function getExistingIntakeQuestionKeys() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("questions").select("key");

  if (error) {
    throw error;
  }

  return ((data ?? []) as { key: string }[]).map((row) => row.key);
}
