import "server-only";

import type { UserProfile } from "@/features/auth/types";
import { getCityModelDistrictBySlug } from "@/features/app/city-model";
import { getCityModelDeliverableRow } from "@/features/city-model-deliverables/queries";
import { getFuturesResearchReportRowByBrand } from "@/features/futures-research/queries";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import { getAdminModuleDetail } from "@/features/modules/queries";
import {
  reviewSubjectLabels,
  type ReviewSubjectType,
} from "@/features/review-comments/types";
import {
  resolveReviewSurface,
  type ReviewSurfaceData,
  type ReviewSurfaceFile,
} from "@/features/review-content/surface";
import { getStakeholderReportRowByBrand } from "@/features/stakeholder-interviews/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/utils";

export type AdminReviewSurface = ReviewSurfaceData & {
  title: string;
  eyebrow: string;
  status: string | null;
  brandName: string | null;
};

async function fileById(fileId: string | null): Promise<ReviewSurfaceFile | null> {
  if (!fileId || !isUuid(fileId)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select("id, storage_path, original_name, mime_type")
    .eq("id", fileId)
    .maybeSingle();
  if (error) throw error;
  const row = data as {
    id: string;
    storage_path: string;
    original_name: string;
    mime_type: string | null;
  } | null;
  if (!row) return null;
  return {
    id: row.id,
    storagePath: row.storage_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
  };
}

async function brandName(brandId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .maybeSingle<{ name: string }>();
  return data?.name ?? null;
}

// Resolves a deliverable's review surface for an INTERNAL staff member, who has
// no brand membership and so cannot use the client review routes. Brand + the
// exact subject are taken from the (verified) notification deep link. Returns
// null when the role is wrong, the brand id is malformed, or the deliverable
// does not exist for that brand — never leaks another brand's content.
export async function getAdminReviewSurface({
  subjectType,
  subjectId,
  brandId,
  profile,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  brandId: string;
  profile: UserProfile;
}): Promise<AdminReviewSurface | null> {
  if (!canViewAdminModulesRole(profile.global_role)) return null;
  if (!isUuid(brandId)) return null;

  let title = reviewSubjectLabels[subjectType];
  let status: string | null = null;
  let file: ReviewSurfaceFile | null = null;

  switch (subjectType) {
    case "STAKEHOLDER_INTERVIEWS": {
      if (!isUuid(subjectId)) return null;
      const row = await getStakeholderReportRowByBrand(brandId);
      if (!row || row.id !== subjectId) return null;
      status = row.status;
      file = await fileById(row.file_id);
      break;
    }
    case "FUTURES_RESEARCH": {
      if (!isUuid(subjectId)) return null;
      const row = await getFuturesResearchReportRowByBrand(brandId);
      if (!row || row.id !== subjectId) return null;
      status = row.status;
      file = await fileById(row.file_id);
      break;
    }
    case "CITY_MODEL_DISTRICT": {
      const district = getCityModelDistrictBySlug(subjectId);
      if (!district) return null;
      const row = await getCityModelDeliverableRow(brandId, district.key);
      if (!row) return null;
      title = district.name;
      status = row.status;
      file = await fileById(row.file_id);
      break;
    }
    case "MODULE": {
      if (!isUuid(subjectId)) return null;
      // getAdminModuleDetail enforces role + INTERNAL_SPECIALIST assignment and
      // returns null when the module is not this internal user's to see.
      const detail = await getAdminModuleDetail({ moduleId: subjectId, profile });
      if (!detail || detail.module.brandId !== brandId) return null;
      title = detail.module.title;
      status = detail.module.status;
      const clientArtifact = detail.artifacts.find(
        (artifact) =>
          artifact.artifactType === "PDF" &&
          artifact.file?.visibility === "CLIENT_REVIEW" &&
          (artifact.file.status === "CLIENT_REVIEW" ||
            artifact.file.status === "CLIENT_APPROVED"),
      );
      file = clientArtifact?.file
        ? {
            id: clientArtifact.file.id,
            storagePath: clientArtifact.file.storagePath,
            originalName: clientArtifact.file.originalName,
            mimeType: clientArtifact.file.mimeType,
          }
        : null;
      break;
    }
    case "BRAND_DOC":
      return null;
  }

  const surface = await resolveReviewSurface({
    subjectType,
    subjectId,
    brandId,
    file,
  });

  return {
    ...surface,
    title,
    eyebrow: `${reviewSubjectLabels[subjectType]} · Internal review`,
    status,
    brandName: await brandName(brandId),
  };
}
