"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import {
  createSignedDownloadUrlForDocument,
  isDocumentServiceError,
  reviewSpecialistDocument,
  uploadBrandDocumentFromFormData,
} from "@/features/documents/services";
import type { DocumentUploadFormState } from "@/features/documents/types";
import { logServerError } from "@/lib/logging/server";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";

function uploadErrorState(message: string): DocumentUploadFormState {
  return { status: "error", message };
}

function readFileId(formData: FormData) {
  const value = formData.get("file_id");
  return typeof value === "string" ? value.trim() : "";
}

export async function uploadDocumentAction(
  _previousState: DocumentUploadFormState,
  formData: FormData,
): Promise<DocumentUploadFormState> {
  const { profile } = await requireUserProfile("/documents");
  const rateLimit = await checkRequestRateLimit({
    bucket: "file.upload",
    identifiers: [profile.id],
    limit: 20,
    windowSeconds: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return uploadErrorState(RATE_LIMITED_MESSAGE);
  }

  try {
    const file = await uploadBrandDocumentFromFormData({
      formData,
      profileId: profile.id,
    });

    revalidatePath("/documents");

    return {
      status: "success",
      message:
        file.status === "PENDING_OWNER_APPROVAL"
          ? "Document uploaded and sent for Owner approval."
          : "Document uploaded.",
      fileId: file.id,
    };
  } catch (error) {
    if (isDocumentServiceError(error)) {
      return uploadErrorState(error.message);
    }

    logServerError({
      label: "[files] upload failed",
      error,
      metadata: {
        profileId: profile.id,
      },
    });

    return uploadErrorState("Document could not be uploaded.");
  }
}

export async function createSignedDownloadUrlAction(formData: FormData) {
  const { profile } = await requireUserProfile("/documents");
  const fileId = readFileId(formData);

  if (!fileId) {
    redirect("/documents");
  }

  const { signedUrl } = await createSignedDownloadUrlForDocument({
    fileId,
    profileId: profile.id,
  });

  redirect(signedUrl);
}

export async function approveSpecialistDocumentAction(formData: FormData) {
  const { profile } = await requireUserProfile("/documents");
  const fileId = readFileId(formData);

  if (fileId) {
    await reviewSpecialistDocument({
      fileId,
      profileId: profile.id,
      decision: "APPROVE",
    });
  }

  revalidatePath("/documents");
}

export async function rejectSpecialistDocumentAction(formData: FormData) {
  const { profile } = await requireUserProfile("/documents");
  const fileId = readFileId(formData);

  if (fileId) {
    await reviewSpecialistDocument({
      fileId,
      profileId: profile.id,
      decision: "REJECT",
    });
  }

  revalidatePath("/documents");
}
