"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import {
  validateIdFormData,
  validateQuestionFormData,
  validateReorderFormData,
  validateSectionFormData,
} from "@/features/admin/intake-builder/schema";
import {
  archiveIntakeQuestion,
  archiveIntakeSection,
  createIntakeQuestion,
  createIntakeSection,
  reorderIntakeQuestion,
  reorderIntakeSection,
  unarchiveIntakeQuestion,
  unarchiveIntakeSection,
  updateIntakeQuestion,
  updateIntakeSection,
} from "@/features/admin/intake-builder/services";
import type { IntakeBuilderFormState } from "@/features/admin/intake-builder/types";
import { requirePlatformOwner } from "@/features/auth/queries";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { logServerError } from "@/lib/logging/server";

function errorState(message: string): IntakeBuilderFormState {
  return { status: "error", message };
}

function successState(message: string): IntakeBuilderFormState {
  return { status: "success", message };
}

function logIntakeBuilderActionError({
  action,
  error,
}: {
  action: string;
  error: unknown;
}) {
  logServerError({
    label: "[intake-builder]",
    error,
    metadata: { action },
  });
}

function revalidateIntakeBuilderPaths() {
  revalidateTag(CACHE_TAGS.intakeConfig, "max");
  revalidatePath("/admin/intake-builder");
  revalidatePath("/dashboard/intake");
}

export async function createIntakeSectionAction(
  _previousState: IntakeBuilderFormState,
  formData: FormData,
): Promise<IntakeBuilderFormState> {
  const { profile } = await requirePlatformOwner("/admin/intake-builder");
  const validation = validateSectionFormData(formData);

  if (validation.error || !validation.data) {
    return errorState(validation.error ?? "Invalid section details.");
  }

  try {
    await createIntakeSection({ input: validation.data, actor: profile });
    revalidateIntakeBuilderPaths();
    return successState("Section created.");
  } catch (error) {
    logIntakeBuilderActionError({ action: "create_section", error });
    return errorState("Section could not be created.");
  }
}

export async function updateIntakeSectionAction(
  _previousState: IntakeBuilderFormState,
  formData: FormData,
): Promise<IntakeBuilderFormState> {
  const { profile } = await requirePlatformOwner("/admin/intake-builder");
  const validation = validateSectionFormData(formData);

  if (validation.error || !validation.data || !validation.data.sectionId) {
    return errorState(validation.error ?? "Missing section identifier.");
  }

  try {
    await updateIntakeSection({
      input: { ...validation.data, sectionId: validation.data.sectionId },
      actor: profile,
    });
    revalidateIntakeBuilderPaths();
    return successState("Section updated.");
  } catch (error) {
    logIntakeBuilderActionError({ action: "update_section", error });
    return errorState("Section could not be updated.");
  }
}

export async function archiveIntakeSectionAction(
  _previousState: IntakeBuilderFormState,
  formData: FormData,
): Promise<IntakeBuilderFormState> {
  const { profile } = await requirePlatformOwner("/admin/intake-builder");
  const validation = validateIdFormData(formData, "section_id");

  if (validation.error || !validation.id) {
    return errorState(validation.error ?? "Missing section identifier.");
  }

  try {
    await archiveIntakeSection({ sectionId: validation.id, actor: profile });
    revalidateIntakeBuilderPaths();
    return successState("Section archived.");
  } catch (error) {
    logIntakeBuilderActionError({ action: "archive_section", error });
    return errorState("Section could not be archived.");
  }
}

export async function unarchiveIntakeSectionAction(
  _previousState: IntakeBuilderFormState,
  formData: FormData,
): Promise<IntakeBuilderFormState> {
  const { profile } = await requirePlatformOwner("/admin/intake-builder");
  const validation = validateIdFormData(formData, "section_id");

  if (validation.error || !validation.id) {
    return errorState(validation.error ?? "Missing section identifier.");
  }

  try {
    await unarchiveIntakeSection({ sectionId: validation.id, actor: profile });
    revalidateIntakeBuilderPaths();
    return successState("Section restored.");
  } catch (error) {
    logIntakeBuilderActionError({ action: "unarchive_section", error });
    return errorState("Section could not be restored.");
  }
}

export async function reorderIntakeSectionAction(
  _previousState: IntakeBuilderFormState,
  formData: FormData,
): Promise<IntakeBuilderFormState> {
  const { profile } = await requirePlatformOwner("/admin/intake-builder");
  const validation = validateReorderFormData(formData);

  if (validation.error || !validation.id || !validation.direction) {
    return errorState(validation.error ?? "Invalid reorder request.");
  }

  try {
    await reorderIntakeSection({
      sectionId: validation.id,
      direction: validation.direction,
      actor: profile,
    });
    revalidateIntakeBuilderPaths();
    return successState("Section order updated.");
  } catch (error) {
    logIntakeBuilderActionError({ action: "reorder_section", error });
    return errorState("Section order could not be updated.");
  }
}

export async function createIntakeQuestionAction(
  _previousState: IntakeBuilderFormState,
  formData: FormData,
): Promise<IntakeBuilderFormState> {
  const { profile } = await requirePlatformOwner("/admin/intake-builder");
  const validation = validateQuestionFormData(formData);

  if (validation.error || !validation.data) {
    return errorState(validation.error ?? "Invalid question details.");
  }

  try {
    await createIntakeQuestion({ input: validation.data, actor: profile });
    revalidateIntakeBuilderPaths();
    return successState("Question created and added to this section.");
  } catch (error) {
    logIntakeBuilderActionError({ action: "create_question", error });
    return errorState("Question could not be created.");
  }
}

export async function updateIntakeQuestionAction(
  _previousState: IntakeBuilderFormState,
  formData: FormData,
): Promise<IntakeBuilderFormState> {
  const { profile } = await requirePlatformOwner("/admin/intake-builder");
  const validation = validateQuestionFormData(formData);

  if (validation.error || !validation.data || !validation.data.questionId) {
    return errorState(validation.error ?? "Missing question identifier.");
  }

  try {
    await updateIntakeQuestion({
      input: { ...validation.data, questionId: validation.data.questionId },
      actor: profile,
    });
    revalidateIntakeBuilderPaths();
    return successState("Question updated.");
  } catch (error) {
    logIntakeBuilderActionError({ action: "update_question", error });
    return errorState("Question could not be updated.");
  }
}

export async function archiveIntakeQuestionAction(
  _previousState: IntakeBuilderFormState,
  formData: FormData,
): Promise<IntakeBuilderFormState> {
  const { profile } = await requirePlatformOwner("/admin/intake-builder");
  const validation = validateIdFormData(formData, "question_id");

  if (validation.error || !validation.id) {
    return errorState(validation.error ?? "Missing question identifier.");
  }

  try {
    await archiveIntakeQuestion({ questionId: validation.id, actor: profile });
    revalidateIntakeBuilderPaths();
    return successState("Question archived.");
  } catch (error) {
    logIntakeBuilderActionError({ action: "archive_question", error });
    return errorState("Question could not be archived.");
  }
}

export async function unarchiveIntakeQuestionAction(
  _previousState: IntakeBuilderFormState,
  formData: FormData,
): Promise<IntakeBuilderFormState> {
  const { profile } = await requirePlatformOwner("/admin/intake-builder");
  const validation = validateIdFormData(formData, "question_id");

  if (validation.error || !validation.id) {
    return errorState(validation.error ?? "Missing question identifier.");
  }

  try {
    await unarchiveIntakeQuestion({ questionId: validation.id, actor: profile });
    revalidateIntakeBuilderPaths();
    return successState("Question restored.");
  } catch (error) {
    logIntakeBuilderActionError({ action: "unarchive_question", error });
    return errorState("Question could not be restored.");
  }
}

export async function reorderIntakeQuestionAction(
  _previousState: IntakeBuilderFormState,
  formData: FormData,
): Promise<IntakeBuilderFormState> {
  const { profile } = await requirePlatformOwner("/admin/intake-builder");
  const validation = validateReorderFormData(formData);

  if (validation.error || !validation.id || !validation.direction) {
    return errorState(validation.error ?? "Invalid reorder request.");
  }

  try {
    await reorderIntakeQuestion({
      questionId: validation.id,
      direction: validation.direction,
      actor: profile,
    });
    revalidateIntakeBuilderPaths();
    return successState("Question order updated.");
  } catch (error) {
    logIntakeBuilderActionError({ action: "reorder_question", error });
    return errorState("Question order could not be updated.");
  }
}
