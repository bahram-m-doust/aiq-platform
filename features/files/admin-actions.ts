"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformOwner } from "@/features/auth/queries";
import {
  adminArchiveFile,
  adminCreateSignedDownloadUrl,
  adminDeleteFile,
  adminUnarchiveFile,
  adminUploadFileForBrand,
  isAdminFileError,
} from "@/features/files/admin-services";
import type {
  AdminFileReviewState,
} from "@/features/files/admin-types";
import type { FileUploadFormState } from "@/features/files/types";
import { logServerError } from "@/lib/logging/server";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function adminFilesPathFor(brandId: string) {
  return `/admin/files?brand_id=${encodeURIComponent(brandId)}`;
}

export async function adminUploadFileAction(
  _prev: FileUploadFormState,
  formData: FormData,
): Promise<FileUploadFormState> {
  const { profile } = await requirePlatformOwner("/admin/files");
  const brandId = readString(formData, "brand_id");

  if (!brandId) {
    return { status: "error", message: "Choose a brand before uploading." };
  }

  const rateLimit = await checkRequestRateLimit({
    bucket: "file.upload",
    identifiers: [profile.id, brandId],
    limit: 20,
    windowSeconds: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return { status: "error", message: RATE_LIMITED_MESSAGE };
  }

  try {
    const record = await adminUploadFileForBrand({
      brandId,
      formData,
      actor: profile,
    });
    revalidatePath("/admin/files");
    return {
      status: "success",
      message: `Uploaded "${record.originalName}".`,
      fileId: record.id,
    };
  } catch (error) {
    if (isAdminFileError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[admin-files] upload failed",
      error,
      metadata: { profileId: profile.id, brandId },
    });
    return { status: "error", message: "File could not be uploaded." };
  }
}

export async function adminArchiveFileAction(
  _prev: AdminFileReviewState,
  formData: FormData,
): Promise<AdminFileReviewState> {
  const { profile } = await requirePlatformOwner("/admin/files");
  const fileId = readString(formData, "file_id");

  if (!fileId) {
    return { status: "error", message: "Missing file identifier." };
  }

  try {
    const after = await adminArchiveFile({ fileId, actor: profile });
    revalidatePath("/admin/files");
    revalidatePath(adminFilesPathFor(after.brandId));
    return { status: "success", message: "File archived." };
  } catch (error) {
    if (isAdminFileError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[admin-files] archive failed",
      error,
      metadata: { profileId: profile.id, fileId },
    });
    return { status: "error", message: "File could not be archived." };
  }
}

export async function adminUnarchiveFileAction(
  _prev: AdminFileReviewState,
  formData: FormData,
): Promise<AdminFileReviewState> {
  const { profile } = await requirePlatformOwner("/admin/files");
  const fileId = readString(formData, "file_id");

  if (!fileId) {
    return { status: "error", message: "Missing file identifier." };
  }

  try {
    const after = await adminUnarchiveFile({ fileId, actor: profile });
    revalidatePath("/admin/files");
    revalidatePath(adminFilesPathFor(after.brandId));
    return { status: "success", message: "File restored." };
  } catch (error) {
    if (isAdminFileError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[admin-files] unarchive failed",
      error,
      metadata: { profileId: profile.id, fileId },
    });
    return { status: "error", message: "File could not be restored." };
  }
}

export async function adminDeleteFileAction(
  _prev: AdminFileReviewState,
  formData: FormData,
): Promise<AdminFileReviewState> {
  const { profile } = await requirePlatformOwner("/admin/files");
  const fileId = readString(formData, "file_id");

  if (!fileId) {
    return { status: "error", message: "Missing file identifier." };
  }

  try {
    const removed = await adminDeleteFile({ fileId, actor: profile });
    revalidatePath("/admin/files");
    revalidatePath(adminFilesPathFor(removed.brandId));
    return { status: "success", message: "File deleted." };
  } catch (error) {
    if (isAdminFileError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[admin-files] delete failed",
      error,
      metadata: { profileId: profile.id, fileId },
    });
    return { status: "error", message: "File could not be deleted." };
  }
}

export async function adminDownloadFileAction(formData: FormData): Promise<void> {
  await requirePlatformOwner("/admin/files");
  const fileId = readString(formData, "file_id");

  if (!fileId) {
    redirect("/admin/files");
  }

  const { signedUrl } = await adminCreateSignedDownloadUrl({ fileId });
  redirect(signedUrl);
}
