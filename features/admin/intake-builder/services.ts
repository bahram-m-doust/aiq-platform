import "server-only";

import {
  buildUniqueTechnicalKey,
  validationSchemaFromOptions,
} from "@/features/admin/intake-builder/schema";
import type {
  IntakeBuilderQuestion,
  IntakeBuilderSection,
  ParsedQuestionFormInput,
  ParsedSectionFormInput,
  ReorderDirection,
} from "@/features/admin/intake-builder/types";
import {
  getExistingIntakeQuestionKeys,
  getExistingIntakeSectionKeys,
  getIntakeBuilderQuestionById,
  getIntakeBuilderSectionById,
  toIntakeBuilderQuestion,
  toIntakeBuilderSection,
  type IntakeBuilderQuestionRow,
  type IntakeBuilderSectionRow,
} from "@/features/admin/intake-builder/queries";
import type { UserProfile } from "@/features/auth/types";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

type AuditActor = Pick<UserProfile, "id" | "global_role">;

function actorRole(actor: AuditActor) {
  return actor.global_role ?? "PLATFORM_OWNER";
}

function sectionAuditShape(section: Omit<IntakeBuilderSection, "questions">) {
  return {
    id: section.id,
    key: section.key,
    title: section.title,
    description: section.description,
    order_index: section.orderIndex,
    is_required: section.isRequired,
    is_active: section.isActive,
  };
}

function questionAuditShape(question: IntakeBuilderQuestion) {
  return {
    id: question.id,
    section_id: question.sectionId,
    key: question.key,
    question_text: question.questionText,
    help_text: question.helpText,
    input_type: question.inputType,
    order_index: question.orderIndex,
    is_required: question.isRequired,
    is_active: question.isActive,
    has_options:
      Boolean(question.validationSchema) &&
      typeof question.validationSchema === "object",
  };
}

async function nextSectionOrderIndex() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("question_sections")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (((data as { order_index?: number } | null)?.order_index ?? 0) + 1);
}

async function nextQuestionOrderIndex(sectionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("questions")
    .select("order_index")
    .eq("section_id", sectionId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (((data as { order_index?: number } | null)?.order_index ?? 0) + 1);
}

export async function createIntakeSection({
  input,
  actor,
}: {
  input: ParsedSectionFormInput;
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const existingKeys = await getExistingIntakeSectionKeys();
  const key = buildUniqueTechnicalKey({
    value: input.title,
    fallback: "SECTION",
    existingKeys,
  });
  const orderIndex = input.orderIndex ?? (await nextSectionOrderIndex());
  const { data, error } = await admin
    .from("question_sections")
    .insert({
      key,
      title: input.title,
      description: input.description,
      is_required: input.isRequired,
      is_active: true,
      order_index: orderIndex,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, key, title, description, order_index, is_required, is_active, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const section = toIntakeBuilderSection(data as IntakeBuilderSectionRow);
  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_section_created",
    entityType: "question_section",
    entityId: section.id,
    after: sectionAuditShape(section),
  });

  return section;
}

export async function updateIntakeSection({
  input,
  actor,
}: {
  input: ParsedSectionFormInput & { sectionId: string };
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const before = await getIntakeBuilderSectionById(input.sectionId);

  if (!before) {
    throw new Error("Section could not be found.");
  }

  const { data, error } = await admin
    .from("question_sections")
    .update({
      title: input.title,
      description: input.description,
      is_required: input.isRequired,
      order_index: input.orderIndex ?? before.orderIndex,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sectionId)
    .select(
      "id, key, title, description, order_index, is_required, is_active, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const after = toIntakeBuilderSection(data as IntakeBuilderSectionRow);
  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_section_updated",
    entityType: "question_section",
    entityId: after.id,
    before: sectionAuditShape(before),
    after: sectionAuditShape(after),
  });

  return after;
}

export async function archiveIntakeSection({
  sectionId,
  actor,
}: {
  sectionId: string;
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const before = await getIntakeBuilderSectionById(sectionId);

  if (!before) {
    throw new Error("Section could not be found.");
  }

  const { data, error } = await admin
    .from("question_sections")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sectionId)
    .select(
      "id, key, title, description, order_index, is_required, is_active, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const after = toIntakeBuilderSection(data as IntakeBuilderSectionRow);
  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_section_archived",
    entityType: "question_section",
    entityId: after.id,
    before: sectionAuditShape(before),
    after: sectionAuditShape(after),
  });

  return after;
}

export async function createIntakeQuestion({
  input,
  actor,
}: {
  input: ParsedQuestionFormInput;
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const section = await getIntakeBuilderSectionById(input.sectionId);

  if (!section) {
    throw new Error("Section could not be found.");
  }

  const existingKeys = await getExistingIntakeQuestionKeys();
  const key = buildUniqueTechnicalKey({
    value: `${section.key} ${input.questionText}`,
    fallback: `${section.key}_QUESTION`,
    existingKeys,
  });
  const orderIndex =
    input.orderIndex ?? (await nextQuestionOrderIndex(input.sectionId));
  const validationSchema = validationSchemaFromOptions({
    inputType: input.inputType,
    options: input.options,
  });
  const { data, error } = await admin
    .from("questions")
    .insert({
      section_id: input.sectionId,
      key,
      question_text: input.questionText,
      help_text: input.helpText,
      input_type: input.inputType,
      is_required: input.isRequired,
      is_active: true,
      order_index: orderIndex,
      validation_schema: validationSchema,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, section_id, key, question_text, help_text, input_type, is_required, is_active, order_index, validation_schema, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const question = toIntakeBuilderQuestion(data as IntakeBuilderQuestionRow);
  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_question_created",
    entityType: "question",
    entityId: question.id,
    after: questionAuditShape(question),
  });

  return question;
}

export async function updateIntakeQuestion({
  input,
  actor,
}: {
  input: ParsedQuestionFormInput & { questionId: string };
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const before = await getIntakeBuilderQuestionById(input.questionId);

  if (!before) {
    throw new Error("Question could not be found.");
  }

  const validationSchema = validationSchemaFromOptions({
    inputType: input.inputType,
    options: input.options,
  });
  const { data, error } = await admin
    .from("questions")
    .update({
      question_text: input.questionText,
      help_text: input.helpText,
      input_type: input.inputType,
      is_required: input.isRequired,
      order_index: input.orderIndex ?? before.orderIndex,
      validation_schema: validationSchema,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.questionId)
    .select(
      "id, section_id, key, question_text, help_text, input_type, is_required, is_active, order_index, validation_schema, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const after = toIntakeBuilderQuestion(data as IntakeBuilderQuestionRow);
  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_question_updated",
    entityType: "question",
    entityId: after.id,
    before: questionAuditShape(before),
    after: questionAuditShape(after),
  });

  return after;
}

export async function archiveIntakeQuestion({
  questionId,
  actor,
}: {
  questionId: string;
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const before = await getIntakeBuilderQuestionById(questionId);

  if (!before) {
    throw new Error("Question could not be found.");
  }

  const { data, error } = await admin
    .from("questions")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId)
    .select(
      "id, section_id, key, question_text, help_text, input_type, is_required, is_active, order_index, validation_schema, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const after = toIntakeBuilderQuestion(data as IntakeBuilderQuestionRow);
  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_question_archived",
    entityType: "question",
    entityId: after.id,
    before: questionAuditShape(before),
    after: questionAuditShape(after),
  });

  return after;
}

export async function deleteIntakeQuestion({
  questionId,
  actor,
}: {
  questionId: string;
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const before = await getIntakeBuilderQuestionById(questionId);

  if (!before) {
    throw new Error("Question could not be found.");
  }

  const { error } = await admin.from("questions").delete().eq("id", questionId);

  if (error) {
    throw error;
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_question_deleted",
    entityType: "question",
    entityId: questionId,
    before: questionAuditShape(before),
  });
}

export async function deleteIntakeSection({
  sectionId,
  actor,
}: {
  sectionId: string;
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const before = await getIntakeBuilderSectionById(sectionId);

  if (!before) {
    throw new Error("Section could not be found.");
  }

  const { error: questionsError } = await admin
    .from("questions")
    .delete()
    .eq("section_id", sectionId);

  if (questionsError) {
    throw questionsError;
  }

  const { error } = await admin
    .from("question_sections")
    .delete()
    .eq("id", sectionId);

  if (error) {
    throw error;
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_section_deleted",
    entityType: "question_section",
    entityId: sectionId,
    before: sectionAuditShape(before),
  });
}

export async function unarchiveIntakeSection({
  sectionId,
  actor,
}: {
  sectionId: string;
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const before = await getIntakeBuilderSectionById(sectionId);

  if (!before) {
    throw new Error("Section could not be found.");
  }

  const { data: activeRows, error: activeError } = await admin
    .from("question_sections")
    .select("order_index")
    .eq("is_active", true);

  if (activeError) {
    throw activeError;
  }

  const nextOrderIndex =
    ((activeRows ?? []) as { order_index: number | null }[]).reduce(
      (max, row) => Math.max(max, row.order_index ?? 0),
      0,
    ) + 1;

  const { data, error } = await admin
    .from("question_sections")
    .update({
      is_active: true,
      order_index: nextOrderIndex,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sectionId)
    .select(
      "id, key, title, description, order_index, is_required, is_active, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const after = toIntakeBuilderSection(data as IntakeBuilderSectionRow);
  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_section_unarchived",
    entityType: "question_section",
    entityId: after.id,
    before: sectionAuditShape(before),
    after: sectionAuditShape(after),
  });

  return after;
}

export async function reorderIntakeSection({
  sectionId,
  direction,
  actor,
}: {
  sectionId: string;
  direction: ReorderDirection;
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("question_sections")
    .select(
      "id, key, title, description, order_index, is_required, is_active, created_at, updated_at",
    )
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const sections = ((data ?? []) as IntakeBuilderSectionRow[]).map(
    toIntakeBuilderSection,
  );
  const currentIndex = sections.findIndex((section) => section.id === sectionId);

  if (currentIndex < 0) {
    throw new Error("Active section could not be found.");
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const target = sections[targetIndex];

  if (!target) {
    return sections[currentIndex];
  }

  const current = sections[currentIndex];
  const now = new Date().toISOString();
  const [currentResult, targetResult] = await Promise.all([
    admin
      .from("question_sections")
      .update({ order_index: target.orderIndex, updated_at: now })
      .eq("id", current.id),
    admin
      .from("question_sections")
      .update({ order_index: current.orderIndex, updated_at: now })
      .eq("id", target.id),
  ]);

  if (currentResult.error) {
    throw currentResult.error;
  }

  if (targetResult.error) {
    throw targetResult.error;
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_section_updated",
    entityType: "question_section",
    entityId: current.id,
    before: sectionAuditShape(current),
    after: {
      ...sectionAuditShape(current),
      order_index: target.orderIndex,
      swapped_with_section_id: target.id,
    },
  });

  return current;
}

export async function unarchiveIntakeQuestion({
  questionId,
  actor,
}: {
  questionId: string;
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const before = await getIntakeBuilderQuestionById(questionId);

  if (!before) {
    throw new Error("Question could not be found.");
  }

  const { data: activeRows, error: activeError } = await admin
    .from("questions")
    .select("order_index")
    .eq("section_id", before.sectionId)
    .eq("is_active", true);

  if (activeError) {
    throw activeError;
  }

  const nextOrderIndex =
    ((activeRows ?? []) as { order_index: number | null }[]).reduce(
      (max, row) => Math.max(max, row.order_index ?? 0),
      0,
    ) + 1;

  const { data, error } = await admin
    .from("questions")
    .update({
      is_active: true,
      order_index: nextOrderIndex,
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId)
    .select(
      "id, section_id, key, question_text, help_text, input_type, is_required, is_active, order_index, validation_schema, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const after = toIntakeBuilderQuestion(data as IntakeBuilderQuestionRow);
  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_question_unarchived",
    entityType: "question",
    entityId: after.id,
    before: questionAuditShape(before),
    after: questionAuditShape(after),
  });

  return after;
}

export async function reorderIntakeQuestion({
  questionId,
  direction,
  actor,
}: {
  questionId: string;
  direction: ReorderDirection;
  actor: AuditActor;
}) {
  const admin = createAdminClient();
  const current = await getIntakeBuilderQuestionById(questionId);

  if (!current || !current.isActive) {
    throw new Error("Active question could not be found.");
  }

  const { data, error } = await admin
    .from("questions")
    .select(
      "id, section_id, key, question_text, help_text, input_type, is_required, is_active, order_index, validation_schema, created_at, updated_at",
    )
    .eq("section_id", current.sectionId)
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const questions = ((data ?? []) as IntakeBuilderQuestionRow[]).map(
    toIntakeBuilderQuestion,
  );
  const currentIndex = questions.findIndex(
    (question) => question.id === questionId,
  );
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const target = questions[targetIndex];

  if (!target) {
    return current;
  }

  const now = new Date().toISOString();
  const [currentResult, targetResult] = await Promise.all([
    admin
      .from("questions")
      .update({ order_index: target.orderIndex, updated_at: now })
      .eq("id", current.id),
    admin
      .from("questions")
      .update({ order_index: current.orderIndex, updated_at: now })
      .eq("id", target.id),
  ]);

  if (currentResult.error) {
    throw currentResult.error;
  }

  if (targetResult.error) {
    throw targetResult.error;
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actorRole(actor),
    action: "intake_question_reordered",
    entityType: "question",
    entityId: current.id,
    before: questionAuditShape(current),
    after: {
      ...questionAuditShape(current),
      order_index: target.orderIndex,
      swapped_with_question_id: target.id,
    },
  });

  return current;
}
