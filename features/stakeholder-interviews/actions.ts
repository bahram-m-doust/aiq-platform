"use server";

import { revalidatePath } from "next/cache";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import {
  getStakeholderReportRowByBrand,
} from "@/features/stakeholder-interviews/queries";
import {
  canReviewStakeholderInterviewRole,
  isStakeholderPdf,
  validateAnnotationBody,
} from "@/features/stakeholder-interviews/schema";
import {
  addStakeholderAnnotation,
  deleteStakeholderAnnotation,
  setStakeholderAnnotationResolved,
  setStakeholderReportStatus,
  updateStakeholderAnnotation,
  uploadStakeholderReport,
} from "@/features/stakeholder-interviews/services";
import type {
  AddAnnotationInput,
  AddAnnotationResult,
  StakeholderActionState,
} from "@/features/stakeholder-interviews/types";

const CLIENT_PATH = "/dashboard/brain/roadmap/stakeholder-interviews";

function revalidateStakeholderPaths() {
  revalidatePath(CLIENT_PATH);
  revalidatePath("/dashboard/brain/roadmap");
  revalidatePath("/dashboard/brain");
}

export async function uploadStakeholderReportAction(
  _prevState: StakeholderActionState,
  formData: FormData,
): Promise<StakeholderActionState> {
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
  if (!isStakeholderPdf(file)) {
    return { status: "error", message: "The report must be a PDF file." };
  }

  await uploadStakeholderReport({ brandId, profileId: profile.id, file });
  revalidateStakeholderPaths();
  revalidatePath("/admin/stakeholder-interviews");

  return { status: "success", message: "Report sent for client review." };
}

async function requireClientReviewer(returnTo: string) {
  const { profile } = await requireUserProfile(returnTo);
  const access = await getBrandAccessSummaryForProfile(profile.id);
  if (
    access.status !== "ACTIVE_ACCESS" ||
    !access.brandId ||
    !canReviewStakeholderInterviewRole(access.membershipRole)
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

export async function addStakeholderAnnotationAction(
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

  const report = await getStakeholderReportRowByBrand(reviewer.brandId);
  if (!report || report.id !== input.reportId) {
    return { ok: false, message: "Report not found." };
  }

  const annotation = await addStakeholderAnnotation({
    reportId: report.id,
    profileId: reviewer.profileId,
    page: input.page,
    posX: input.posX,
    posY: input.posY,
    body: value,
    parentId: input.parentId ?? null,
  });
  revalidateStakeholderPaths();

  return {
    ok: true,
    annotation: {
      ...annotation,
      authorName: reviewer.authorName,
      authorEmail: reviewer.authorEmail,
    },
  };
}

export async function resolveStakeholderAnnotationAction(
  annotationId: string,
  resolved: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const reviewer = await requireClientReviewer(CLIENT_PATH);
  if (!reviewer) return { ok: false, message: "Not allowed." };

  const report = await getStakeholderReportRowByBrand(reviewer.brandId);
  if (!report) return { ok: false, message: "Report not found." };

  await setStakeholderAnnotationResolved({
    annotationId,
    reportId: report.id,
    resolved,
  });
  revalidateStakeholderPaths();
  return { ok: true };
}

export async function editStakeholderAnnotationAction(
  annotationId: string,
  body: string,
): Promise<{ ok: boolean; message?: string }> {
  const reviewer = await requireClientReviewer(CLIENT_PATH);
  if (!reviewer) return { ok: false, message: "Not allowed." };

  const { value, error } = validateAnnotationBody(body);
  if (!value) return { ok: false, message: error ?? "Enter a comment." };

  const report = await getStakeholderReportRowByBrand(reviewer.brandId);
  if (!report) return { ok: false, message: "Report not found." };

  await updateStakeholderAnnotation({
    annotationId,
    reportId: report.id,
    authorId: reviewer.profileId,
    body: value,
  });
  revalidateStakeholderPaths();
  return { ok: true };
}

export async function deleteStakeholderAnnotationAction(
  annotationId: string,
): Promise<{ ok: boolean; message?: string }> {
  const reviewer = await requireClientReviewer(CLIENT_PATH);
  if (!reviewer) return { ok: false, message: "Not allowed." };

  const report = await getStakeholderReportRowByBrand(reviewer.brandId);
  if (!report) return { ok: false, message: "Report not found." };

  await deleteStakeholderAnnotation({
    annotationId,
    reportId: report.id,
    authorId: reviewer.profileId,
  });
  revalidateStakeholderPaths();
  return { ok: true };
}

export async function approveStakeholderReportAction(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const reviewer = await requireClientReviewer(CLIENT_PATH);
  if (!reviewer) {
    return { ok: false, message: "You cannot review this report." };
  }

  const report = await getStakeholderReportRowByBrand(reviewer.brandId);
  if (!report || !report.file_id) {
    return { ok: false, message: "There is no report to review yet." };
  }

  await setStakeholderReportStatus({
    brandId: reviewer.brandId,
    profileId: reviewer.profileId,
    status: "APPROVED",
  });
  revalidateStakeholderPaths();

  return { ok: true };
}
