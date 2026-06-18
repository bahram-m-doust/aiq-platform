"use server";

import { revalidatePath } from "next/cache";

import {
  cityModelDistrictPath,
  getCityModelDistrictByKey,
  getCityModelDistrictBySlug,
  isCityModelDistrictKey,
} from "@/features/app/city-model";
import { requireUserProfile } from "@/features/auth/queries";
import { isPdfFile } from "@/features/city-model-deliverables/schema";
import { getCityModelDeliverableRow } from "@/features/city-model-deliverables/queries";
import { detachDeliverableFile } from "@/features/review-deliverables/detach-service";
import { requireDeliverableReviewer } from "@/features/review-deliverables/reviewer";
import {
  setCityModelDistrictStatus,
  uploadCityModelDistrictFile,
} from "@/features/city-model-deliverables/services";
import type { CityModelUploadState } from "@/features/city-model-deliverables/types";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import { ROUTES } from "@/lib/routes";
import { logServerError } from "@/lib/logging/server";
import { validateSecureUpload } from "@/lib/security/file-upload";

function revalidateDistrict(slug?: string) {
  revalidatePath(ROUTES.brainRoadmapCityModel);
  revalidatePath(ROUTES.brainRoadmap);
  revalidatePath("/admin/city-model");
  if (slug) revalidatePath(cityModelDistrictPath(slug));
}

export async function uploadCityModelDistrictFileAction(
  _prev: CityModelUploadState,
  formData: FormData,
): Promise<CityModelUploadState> {
  const { profile } = await requireUserProfile("/admin");
  if (!canViewAdminModulesRole(profile.global_role)) {
    return { status: "error", message: "You cannot upload this file." };
  }

  const brandId = String(formData.get("brand_id") ?? "").trim();
  const districtKey = String(formData.get("district_key") ?? "").trim();
  const file = formData.get("file");

  if (!brandId) {
    return { status: "error", message: "Select a brand." };
  }
  if (!isCityModelDistrictKey(districtKey)) {
    return { status: "error", message: "Unknown district." };
  }
  if (!(file instanceof File) || file.size <= 0) {
    return { status: "error", message: "Choose a PDF file to upload." };
  }
  if (!isPdfFile(file)) {
    return { status: "error", message: "The file must be a PDF." };
  }
  const validation = await validateSecureUpload({ file, allowedKinds: ["PDF"] });
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  try {
    await uploadCityModelDistrictFile({
      brandId,
      districtKey,
      profileId: profile.id,
      file,
    });
  } catch (error) {
    logServerError({
      label: "[city-model] district file upload failed",
      error,
      metadata: { brandId, districtKey },
    });
    return {
      status: "error",
      message: "Could not upload the file. Please try again.",
    };
  }

  revalidateDistrict(getCityModelDistrictByKey(districtKey)?.slug);
  return { status: "success", message: "File sent for client review." };
}

async function decideDistrict(
  slug: string,
  status: "APPROVED" | "CHANGES_REQUESTED",
): Promise<{ ok: boolean; message?: string }> {
  const district = getCityModelDistrictBySlug(slug);
  if (!district) return { ok: false, message: "Unknown district." };

  const reviewer = await requireDeliverableReviewer(cityModelDistrictPath(slug));
  if (!reviewer) {
    return { ok: false, message: "You cannot review this district." };
  }

  const row = await getCityModelDeliverableRow(reviewer.brandId, district.key);
  if (!row || !row.file_id) {
    return { ok: false, message: "There is nothing to review yet." };
  }

  try {
    await setCityModelDistrictStatus({
      brandId: reviewer.brandId,
      districtKey: district.key,
      profileId: reviewer.profileId,
      status,
    });
  } catch (error) {
    logServerError({
      label: "[city-model] review decision failed",
      error,
      metadata: { brandId: reviewer.brandId, districtKey: district.key },
    });
    return { ok: false, message: "Could not record the decision. Try again." };
  }
  revalidateDistrict(slug);
  return { ok: true };
}

export async function deleteCityModelDistrictFileAction({
  brandId,
  districtKey,
}: {
  brandId: string;
  districtKey: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { profile } = await requireUserProfile("/admin/city-model");
  if (!canViewAdminModulesRole(profile.global_role)) {
    return { ok: false, message: "You cannot delete this file." };
  }
  if (!brandId) return { ok: false, message: "Select a brand." };
  if (!isCityModelDistrictKey(districtKey)) {
    return { ok: false, message: "Unknown district." };
  }

  try {
    await detachDeliverableFile({
      table: "city_model_district_files",
      match: { brand_id: brandId, district_key: districtKey },
    });
  } catch (error) {
    logServerError({
      label: "[city-model] district file delete failed",
      error,
      metadata: { brandId, districtKey },
    });
    return { ok: false, message: "Could not delete the file. Try again." };
  }

  revalidateDistrict(getCityModelDistrictByKey(districtKey)?.slug);
  return { ok: true };
}

export async function approveCityModelDistrictAction(slug: string) {
  return decideDistrict(slug, "APPROVED");
}
