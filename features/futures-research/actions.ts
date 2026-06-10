"use server";

import { revalidatePath } from "next/cache";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { getFuturesResearchReportRowByBrand } from "@/features/futures-research/queries";
import {
  canReviewFuturesResearchRole,
  isFuturesResearchPdf,
  isFuturesResearchStoryline,
  maxFuturesResearchStorylineBytes,
  validateAnnotationBody,
} from "@/features/futures-research/schema";
import {
  addFuturesResearchAnnotation,
  deleteFuturesResearchAnnotation,
  setFuturesResearchAnnotationResolved,
  setFuturesResearchReportStatus,
  updateFuturesResearchAnnotation,
  uploadFuturesResearchReport,
  uploadFuturesResearchStoryline,
} from "@/features/futures-research/services";
import type {
  AddAnnotationInput,
  AddAnnotationResult,
  FuturesResearchActionState,
} from "@/features/futures-research/types";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import { validateSecureUpload } from "@/lib/security/file-upload";

const CLIENT_PATH = "/dashboard/brain/roadmap/futures-research";

function revalidateFuturesResearchPaths() {
  revalidatePath(CLIENT_PATH);
  revalidatePath("/dashboard/brain/roadmap");
  revalidatePath("/dashboard/brain");
}

export async function uploadFuturesResearchReportAction(
  _prevState: FuturesResearchActionState,
  formData: FormData,
): Promise<FuturesResearchActionState> {
  const { profile } = await requireUserProfile("/admin");

  if (!canViewAdminModulesRole(profile.global_role)) {
    return { status: "error", message: "You cannot upload this report." };
  }

  const brandId = String(formData.get("brand_id") ?? "").trim();
  const file = formData.get("file");

  if (!brandId) {
    return { status: "error", message: "Select a brand." };
  }
  if (!(file instanceof File) || file.size <= 0) {
    return { status: "error", message: "Choose a PDF file to upload." };
  }
  if (!isFuturesResearchPdf(file)) {
    return {
      status: "error",
      message: "The report must be a valid PDF file up to 10 MB.",
    };
  }
  const validation = await validateSecureUpload({
    file,
    allowedKinds: ["PDF"],
  });
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  await uploadFuturesResearchReport({ brandId, profileId: profile.id, file });
  revalidateFuturesResearchPaths();
  revalidatePath("/admin/futures-research");

  return { status: "success", message: "Report sent for client review." };
}

export async function uploadFuturesResearchStorylineAction(
  _prevState: FuturesResearchActionState,
  formData: FormData,
): Promise<FuturesResearchActionState> {
  const { profile } = await requireUserProfile("/admin");

  if (!canViewAdminModulesRole(profile.global_role)) {
    return { status: "error", message: "You cannot upload this storyline." };
  }

  const brandId = String(formData.get("brand_id") ?? "").trim();
  const file = formData.get("file");

  if (!brandId) {
    return { status: "error", message: "Select a brand." };
  }
  if (!(file instanceof File) || file.size <= 0) {
    return { status: "error", message: "Choose an HTML file to upload." };
  }
  if (!isFuturesResearchStoryline(file)) {
    return {
      status: "error",
      message: "The storyline must be a valid HTML file up to 5 MB.",
    };
  }
  const validation = await validateSecureUpload({
    file,
    allowedKinds: ["HTML"],
    maxBytes: maxFuturesResearchStorylineBytes,
  });
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  await uploadFuturesResearchStoryline({ brandId, profileId: profile.id, file });
  revalidateFuturesResearchPaths();
  revalidatePath("/admin/futures-research");

  return { status: "success", message: "Storyline attached for the client." };
}

async function requireClientReviewer(returnTo: string) {
  const { profile } = await requireUserProfile(returnTo);
  const access = await getBrandAccessSummaryForProfile(profile.id);
  if (
    access.status !== "ACTIVE_ACCESS" ||
    !access.brandId ||
    !canReviewFuturesResearchRole(access.membershipRole)
  ) {
    return null;
  }
  return {
    profileId: profile.id,
    brandId: access.brandId,
    authorName: profile.full_name ?? null,
    authorEmail: profile.email ?? null,
  };
}

export async function addFuturesResearchAnnotationAction(
  input: AddAnnotationInput,
): Promise<AddAnnotationResult> {
  const reviewer = await requireClientReviewer(CLIENT_PATH);
  if (!reviewer) {
    return { ok: false, message: "You cannot comment on this report." };
  }

  const { value, error } = validateAnnotationBody(input.body);
  if (!value) {
    return { ok: false, message: error ?? "Enter a comment." };
  }

  const report = await getFuturesResearchReportRowByBrand(reviewer.brandId);
  if (!report || report.id !== input.reportId) {
    return { ok: false, message: "Report not found." };
  }

  const annotation = await addFuturesResearchAnnotation({
    reportId: report.id,
    profileId: reviewer.profileId,
    page: input.page,
    posX: input.posX,
    posY: input.posY,
    body: value,
    parentId: input.parentId ?? null,
  });
  revalidateFuturesResearchPaths();

  return {
    ok: true,
    annotation: {
      ...annotation,
      authorName: reviewer.authorName,
      authorEmail: reviewer.authorEmail,
    },
  };
}

export async function resolveFuturesResearchAnnotationAction(
  annotationId: string,
  resolved: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const reviewer = await requireClientReviewer(CLIENT_PATH);
  if (!reviewer) return { ok: false, message: "Not allowed." };

  const report = await getFuturesResearchReportRowByBrand(reviewer.brandId);
  if (!report) return { ok: false, message: "Report not found." };

  await setFuturesResearchAnnotationResolved({
    annotationId,
    reportId: report.id,
    resolved,
  });
  revalidateFuturesResearchPaths();
  return { ok: true };
}

export async function editFuturesResearchAnnotationAction(
  annotationId: string,
  body: string,
): Promise<{ ok: boolean; message?: string }> {
  const reviewer = await requireClientReviewer(CLIENT_PATH);
  if (!reviewer) return { ok: false, message: "Not allowed." };

  const { value, error } = validateAnnotationBody(body);
  if (!value) return { ok: false, message: error ?? "Enter a comment." };

  const report = await getFuturesResearchReportRowByBrand(reviewer.brandId);
  if (!report) return { ok: false, message: "Report not found." };

  await updateFuturesResearchAnnotation({
    annotationId,
    reportId: report.id,
    authorId: reviewer.profileId,
    body: value,
  });
  revalidateFuturesResearchPaths();
  return { ok: true };
}

export async function deleteFuturesResearchAnnotationAction(
  annotationId: string,
): Promise<{ ok: boolean; message?: string }> {
  const reviewer = await requireClientReviewer(CLIENT_PATH);
  if (!reviewer) return { ok: false, message: "Not allowed." };

  const report = await getFuturesResearchReportRowByBrand(reviewer.brandId);
  if (!report) return { ok: false, message: "Report not found." };

  await deleteFuturesResearchAnnotation({
    annotationId,
    reportId: report.id,
    authorId: reviewer.profileId,
  });
  revalidateFuturesResearchPaths();
  return { ok: true };
}

export async function approveFuturesResearchReportAction(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const reviewer = await requireClientReviewer(CLIENT_PATH);
  if (!reviewer) {
    return { ok: false, message: "You cannot review this report." };
  }

  const report = await getFuturesResearchReportRowByBrand(reviewer.brandId);
  if (!report || !report.file_id) {
    return { ok: false, message: "There is no report to review yet." };
  }

  await setFuturesResearchReportStatus({
    brandId: reviewer.brandId,
    profileId: reviewer.profileId,
    status: "APPROVED",
  });
  revalidateFuturesResearchPaths();

  return { ok: true };
}
