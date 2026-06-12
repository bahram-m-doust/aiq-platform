import "server-only";

import { getCityModelDistrictBySlug } from "@/features/app/city-model";
import type { ReviewSubjectType } from "@/features/review-comments/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/utils";

async function rowExists(
  table: string,
  match: Record<string, string>,
): Promise<boolean> {
  const admin = createAdminClient();
  let query = admin.from(table).select("id").limit(1);
  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// Confirms that a (subjectType, subjectId) pair really is a deliverable of the
// given brand before a comment may be attached to it. Without this check a
// reviewer could forge another brand's report id (IDOR) and hang comments —
// and internal-team notifications — off a deliverable they cannot even see.
// Queries the tables directly so review-comments doesn't import feature
// modules (keeps the dependency direction: features → review-comments).
export async function verifyReviewSubject({
  subjectType,
  subjectId,
  brandId,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  brandId: string;
}): Promise<boolean> {
  switch (subjectType) {
    case "STAKEHOLDER_INTERVIEWS":
      return (
        isUuid(subjectId) &&
        rowExists("stakeholder_interview_reports", {
          id: subjectId,
          brand_id: brandId,
        })
      );
    case "FUTURES_RESEARCH":
      return (
        isUuid(subjectId) &&
        rowExists("futures_research_reports", {
          id: subjectId,
          brand_id: brandId,
        })
      );
    case "CITY_MODEL_DISTRICT": {
      // The subject id is the district slug (shared across brands); ownership
      // means this brand has a deliverable row for that district.
      const district = getCityModelDistrictBySlug(subjectId);
      if (!district) return false;
      return rowExists("city_model_district_files", {
        brand_id: brandId,
        district_key: district.key,
      });
    }
    case "MODULE":
      return (
        isUuid(subjectId) &&
        rowExists("brand_modules", { id: subjectId, brand_id: brandId })
      );
    case "BRAND_DOC":
      // No reviewable brand-doc surface exists yet — refuse rather than
      // accept unverifiable subjects.
      return false;
  }
}

async function brandOfRow(
  table: string,
  subjectId: string,
): Promise<string | null> {
  if (!isUuid(subjectId)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(table)
    .select("brand_id")
    .eq("id", subjectId)
    .maybeSingle();
  if (error) throw error;
  return (data as { brand_id: string } | null)?.brand_id ?? null;
}

// Resolves which brand a subject belongs to — used when an INTERNAL user (who
// has no brand membership) replies to a client comment: the comment must carry
// the subject's brand so the client's brand-scoped inbox and comment reads see
// it. City-model districts are keyed by slug (shared across brands), so the
// brand is not derivable from the subject alone — internal authors reach those
// only through a brand-membership flow, which resolves the brand instead.
export async function getReviewSubjectBrand({
  subjectType,
  subjectId,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
}): Promise<string | null> {
  switch (subjectType) {
    case "STAKEHOLDER_INTERVIEWS":
      return brandOfRow("stakeholder_interview_reports", subjectId);
    case "FUTURES_RESEARCH":
      return brandOfRow("futures_research_reports", subjectId);
    case "MODULE":
      return brandOfRow("brand_modules", subjectId);
    case "CITY_MODEL_DISTRICT":
    case "BRAND_DOC":
      return null;
  }
}
