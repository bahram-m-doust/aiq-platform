"use server";

import { revalidatePath } from "next/cache";

import { logServerError } from "@/lib/logging/server";
import { requireUserProfile } from "@/features/auth/queries";
import { detachDeliverableFile } from "@/features/review-deliverables/detach-service";
import { requireDeliverableReviewer as requireClientReviewer } from "@/features/review-deliverables/reviewer";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import { validateSecureUpload } from "@/lib/security/file-upload";
import { getStakeholderReportRowByBrand } from "@/features/stakeholder-interviews/queries";
import { isStakeholderPdf } from "@/features/stakeholder-interviews/schema";
import {
  setStakeholderReportStatus,
  uploadStakeholderReport,
} from "@/features/stakeholder-interviews/services";
import type { StakeholderActionState } from "@/features/stakeholder-interviews/types";

const CLIENT_PATH = "/integrated-brand-brain/roadmap/stakeholder-interviews";

function revalidateStakeholderPaths() {
  revalidatePath(CLIENT_PATH);
  revalidatePath("/integrated-brand-brain/roadmap");
  revalidatePath("/integrated-brand-brain");
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
  const validation = await validateSecureUpload({
    file,
    allowedKinds: ["PDF"],
  });
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  try {
    await uploadStakeholderReport({ brandId, profileId: profile.id, file });
  } catch (error) {
    logServerError({
      label: "[stakeholder] report upload failed",
      error,
      metadata: { profileId: profile.id, brandId },
    });
    return {
      status: "error",
      message: "Could not upload the report. Please try again.",
    };
  }

  revalidateStakeholderPaths();
  revalidatePath("/admin/stakeholder-interviews");

  return { status: "success", message: "Report sent for client review." };
}

export async function deleteStakeholderReportAction({
  brandId,
}: {
  brandId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { profile } = await requireUserProfile("/admin/stakeholder-interviews");
  if (!canViewAdminModulesRole(profile.global_role)) {
    return { ok: false, message: "You cannot delete this report." };
  }
  if (!brandId) return { ok: false, message: "Select a brand." };

  try {
    await detachDeliverableFile({
      table: "stakeholder_interview_reports",
      match: { brand_id: brandId },
    });
  } catch (error) {
    logServerError({
      label: "[stakeholder] report delete failed",
      error,
      metadata: { brandId },
    });
    return { ok: false, message: "Could not delete the report. Try again." };
  }

  revalidateStakeholderPaths();
  revalidatePath("/admin/stakeholder-interviews");
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

  try {
    await setStakeholderReportStatus({
      brandId: reviewer.brandId,
      profileId: reviewer.profileId,
      status: "APPROVED",
    });
  } catch (error) {
    logServerError({
      label: "[stakeholder] approve failed",
      error,
      metadata: { brandId: reviewer.brandId },
    });
    return { ok: false, message: "Could not record the decision. Try again." };
  }
  revalidateStakeholderPaths();

  return { ok: true };
}
