"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import {
  createSignedDownloadUrlForFile,
  isFileServiceError,
  reviewSpecialistFile,
  uploadBrandFileFromFormData,
} from "@/features/files/services";
import type { FileUploadFormState } from "@/features/files/types";
import { logServerError } from "@/lib/logging/server";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";

function uploadErrorState(message: string): FileUploadFormState {
  return { status: "error", message };
}

function readFileId(formData: FormData) {
  const value = formData.get("file_id");
  return typeof value === "string" ? value.trim() : "";
}

export async function uploadFileAction(
  _previousState: FileUploadFormState,
  formData: FormData,
): Promise<FileUploadFormState> {
  const { profile } = await requireUserProfile("/dashboard/files");
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
    const file = await uploadBrandFileFromFormData({
      formData,
      profileId: profile.id,
    });

    revalidatePath("/dashboard/files");

    return {
      status: "success",
      message:
        file.status === "PENDING_OWNER_APPROVAL"
          ? "File uploaded and sent for Owner approval."
          : "File uploaded.",
      fileId: file.id,
    };
  } catch (error) {
    if (isFileServiceError(error)) {
      return uploadErrorState(error.message);
    }

    logServerError({
      label: "[files] upload failed",
      error,
      metadata: {
        profileId: profile.id,
      },
    });

    return uploadErrorState("File could not be uploaded.");
  }
}

export async function createSignedDownloadUrlAction(formData: FormData) {
  const { profile } = await requireUserProfile("/dashboard/files");
  const fileId = readFileId(formData);

  if (!fileId) {
    redirect("/dashboard/files");
  }

  const { signedUrl } = await createSignedDownloadUrlForFile({
    fileId,
    profileId: profile.id,
  });

  redirect(signedUrl);
}

export async function approveSpecialistFileAction(formData: FormData) {
  const { profile } = await requireUserProfile("/dashboard/files");
  const fileId = readFileId(formData);

  if (fileId) {
    await reviewSpecialistFile({
      fileId,
      profileId: profile.id,
      decision: "APPROVE",
    });
  }

  revalidatePath("/dashboard/files");
}

export async function rejectSpecialistFileAction(formData: FormData) {
  const { profile } = await requireUserProfile("/dashboard/files");
  const fileId = readFileId(formData);

  if (fileId) {
    await reviewSpecialistFile({
      fileId,
      profileId: profile.id,
      decision: "REJECT",
    });
  }

  revalidatePath("/dashboard/files");
}
