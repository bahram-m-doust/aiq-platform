"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformOwner } from "@/features/auth/queries";
import {
  adminArchiveDocument,
  adminCreateSignedDownloadUrl,
  adminDeleteDocument,
  adminDemoteDocumentFromRag,
  adminPromoteDocumentToRag,
  adminUnarchiveDocument,
  adminUploadDocumentForBrand,
  isAdminDocumentError,
} from "@/features/documents/admin-services";
import type {
  AdminDocumentReviewState,
} from "@/features/documents/admin-types";
import type { DocumentUploadFormState } from "@/features/documents/types";
import { logServerError } from "@/lib/logging/server";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function adminDocumentsPathFor(brandId: string) {
  return `/admin/documents?brand_id=${encodeURIComponent(brandId)}`;
}

export async function adminUploadDocumentAction(
  _prev: DocumentUploadFormState,
  formData: FormData,
): Promise<DocumentUploadFormState> {
  const { profile } = await requirePlatformOwner("/admin/documents");
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

  const sendToRag = formData.get("send_to_rag") === "true";

  try {
    const record = await adminUploadDocumentForBrand({
      brandId,
      formData,
      actor: profile,
      sendToRag,
    });
    revalidatePath("/admin/documents");
    return {
      status: "success",
      message: `Uploaded "${record.originalName}".`,
      fileId: record.id,
    };
  } catch (error) {
    if (isAdminDocumentError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[admin-files] upload failed",
      error,
      metadata: { profileId: profile.id, brandId },
    });
    return { status: "error", message: "Document could not be uploaded." };
  }
}

export async function adminArchiveDocumentAction(
  _prev: AdminDocumentReviewState,
  formData: FormData,
): Promise<AdminDocumentReviewState> {
  const { profile } = await requirePlatformOwner("/admin/documents");
  const fileId = readString(formData, "file_id");

  if (!fileId) {
    return { status: "error", message: "Missing document identifier." };
  }

  try {
    const after = await adminArchiveDocument({ fileId, actor: profile });
    revalidatePath("/admin/documents");
    revalidatePath(adminDocumentsPathFor(after.brandId));
    return { status: "success", message: "Document archived." };
  } catch (error) {
    if (isAdminDocumentError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[admin-files] archive failed",
      error,
      metadata: { profileId: profile.id, fileId },
    });
    return { status: "error", message: "Document could not be archived." };
  }
}

export async function adminUnarchiveDocumentAction(
  _prev: AdminDocumentReviewState,
  formData: FormData,
): Promise<AdminDocumentReviewState> {
  const { profile } = await requirePlatformOwner("/admin/documents");
  const fileId = readString(formData, "file_id");

  if (!fileId) {
    return { status: "error", message: "Missing document identifier." };
  }

  try {
    const after = await adminUnarchiveDocument({ fileId, actor: profile });
    revalidatePath("/admin/documents");
    revalidatePath(adminDocumentsPathFor(after.brandId));
    return { status: "success", message: "Document restored." };
  } catch (error) {
    if (isAdminDocumentError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[admin-files] unarchive failed",
      error,
      metadata: { profileId: profile.id, fileId },
    });
    return { status: "error", message: "Document could not be restored." };
  }
}

export async function adminDeleteDocumentAction(
  _prev: AdminDocumentReviewState,
  formData: FormData,
): Promise<AdminDocumentReviewState> {
  const { profile } = await requirePlatformOwner("/admin/documents");
  const fileId = readString(formData, "file_id");

  if (!fileId) {
    return { status: "error", message: "Missing document identifier." };
  }

  try {
    const removed = await adminDeleteDocument({ fileId, actor: profile });
    revalidatePath("/admin/documents");
    revalidatePath(adminDocumentsPathFor(removed.brandId));
    return { status: "success", message: "Document deleted." };
  } catch (error) {
    if (isAdminDocumentError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[admin-files] delete failed",
      error,
      metadata: { profileId: profile.id, fileId },
    });
    return { status: "error", message: "Document could not be deleted." };
  }
}

export async function adminPromoteDocumentToRagAction(
  _prev: AdminDocumentReviewState,
  formData: FormData,
): Promise<AdminDocumentReviewState> {
  const { profile } = await requirePlatformOwner("/admin/documents");
  const fileId = readString(formData, "file_id");

  if (!fileId) {
    return { status: "error", message: "Missing document identifier." };
  }

  try {
    const after = await adminPromoteDocumentToRag({ fileId, actor: profile });
    revalidatePath("/admin/documents");
    revalidatePath(adminDocumentsPathFor(after.brandId));
    revalidatePath("/admin/rag");
    return { status: "success", message: "Document promoted to RAG." };
  } catch (error) {
    if (isAdminDocumentError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[admin-files] RAG promotion failed",
      error,
      metadata: { profileId: profile.id, fileId },
    });
    return { status: "error", message: "Document could not be promoted to RAG." };
  }
}

export async function adminDemoteDocumentFromRagAction(
  _prev: AdminDocumentReviewState,
  formData: FormData,
): Promise<AdminDocumentReviewState> {
  const { profile } = await requirePlatformOwner("/admin/documents");
  const fileId = readString(formData, "file_id");

  if (!fileId) {
    return { status: "error", message: "Missing document identifier." };
  }

  try {
    const after = await adminDemoteDocumentFromRag({ fileId, actor: profile });
    revalidatePath("/admin/documents");
    revalidatePath(adminDocumentsPathFor(after.brandId));
    revalidatePath("/admin/rag");
    return { status: "success", message: "Document removed from RAG." };
  } catch (error) {
    if (isAdminDocumentError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[admin-files] RAG demotion failed",
      error,
      metadata: { profileId: profile.id, fileId },
    });
    return { status: "error", message: "Document could not be removed from RAG." };
  }
}

export async function adminDownloadDocumentAction(formData: FormData): Promise<void> {
  await requirePlatformOwner("/admin/documents");
  const fileId = readString(formData, "file_id");

  if (!fileId) {
    redirect("/admin/documents");
  }

  const { signedUrl } = await adminCreateSignedDownloadUrl({ fileId });
  redirect(signedUrl);
}
