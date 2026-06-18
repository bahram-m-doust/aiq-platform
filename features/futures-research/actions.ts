"use server";

import { revalidatePath } from "next/cache";

import { requireUserProfile } from "@/features/auth/queries";
import { getFuturesResearchReportRowByBrand } from "@/features/futures-research/queries";
import {
  isFuturesResearchPdf,
  isFuturesResearchStoryline,
  maxFuturesResearchStorylineBytes,
} from "@/features/futures-research/schema";
import { detachDeliverableFile } from "@/features/review-deliverables/detach-service";
import { requireDeliverableReviewer as requireClientReviewer } from "@/features/review-deliverables/reviewer";
import {
  setFuturesResearchReportStatus,
  uploadFuturesResearchReport,
  uploadFuturesResearchStoryline,
} from "@/features/futures-research/services";
import type { FuturesResearchActionState } from "@/features/futures-research/types";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import { logServerError } from "@/lib/logging/server";
import { ROUTES } from "@/lib/routes";
import { validateSecureUpload } from "@/lib/security/file-upload";

const CLIENT_PATH = ROUTES.brainRoadmapFuturesResearch;

function revalidateFuturesResearchPaths() {
  revalidatePath(CLIENT_PATH);
  revalidatePath(ROUTES.brainRoadmap);
  revalidatePath(ROUTES.brain);
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

  try {
    await uploadFuturesResearchReport({ brandId, profileId: profile.id, file });
  } catch (error) {
    logServerError({
      label: "[futures-research] report upload failed",
      error,
      metadata: { profileId: profile.id, brandId },
    });
    return {
      status: "error",
      message: "Could not upload the report. Please try again.",
    };
  }

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

  try {
    await uploadFuturesResearchStoryline({
      brandId,
      profileId: profile.id,
      file,
    });
  } catch (error) {
    logServerError({
      label: "[futures-research] storyline upload failed",
      error,
      metadata: { profileId: profile.id, brandId },
    });
    return {
      status: "error",
      message: "Could not upload the storyline. Please try again.",
    };
  }

  revalidateFuturesResearchPaths();
  revalidatePath("/admin/futures-research");

  return { status: "success", message: "Storyline attached for the client." };
}


export async function deleteFuturesResearchReportAction({
  brandId,
}: {
  brandId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { profile } = await requireUserProfile("/admin/futures-research");
  if (!canViewAdminModulesRole(profile.global_role)) {
    return { ok: false, message: "You cannot delete this report." };
  }
  if (!brandId) return { ok: false, message: "Select a brand." };

  try {
    await detachDeliverableFile({
      table: "futures_research_reports",
      match: { brand_id: brandId },
      // Remove both the report PDF and any attached storyline.
      fileColumns: ["file_id", "storyline_file_id"],
    });
  } catch (error) {
    logServerError({
      label: "[futures-research] report delete failed",
      error,
      metadata: { brandId },
    });
    return { ok: false, message: "Could not delete the report. Try again." };
  }

  revalidateFuturesResearchPaths();
  revalidatePath("/admin/futures-research");
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

  try {
    await setFuturesResearchReportStatus({
      brandId: reviewer.brandId,
      profileId: reviewer.profileId,
      status: "APPROVED",
    });
  } catch (error) {
    logServerError({
      label: "[futures-research] approve failed",
      error,
      metadata: { brandId: reviewer.brandId },
    });
    return { ok: false, message: "Could not record the decision. Try again." };
  }
  revalidateFuturesResearchPaths();

  return { ok: true };
}
