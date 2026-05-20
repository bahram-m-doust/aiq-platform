import "server-only";

import {
  getIntakeAccessForProfile,
  getIntakeSectionsWithQuestions,
  getLatestIntakeSessionForBrand,
} from "@/features/intake/queries";
import {
  isChangeRequestStatus,
  isChangeRequestTargetType,
  sortChangeRequestsByCreatedAt,
  targetLabelForRequest,
} from "@/features/change-requests/schema";
import type {
  ChangeRequestCreateOptions,
  ChangeRequestModuleOption,
  ChangeRequestRecord,
  ChangeRequestReviewItem,
  ChangeRequestStatus,
  ChangeRequestTargetType,
} from "@/features/change-requests/types";
import { createAdminClient } from "@/lib/supabase/admin";

type ModuleRow = {
  id: string;
  title: string;
  module_type: string;
  status: string;
};

type ChangeRequestRow = {
  id: string;
  brand_id: string;
  target_type: string;
  target_id: string | null;
  section_key: string | null;
  question_id: string | null;
  requested_by: string | null;
  reason: string | null;
  comment: string;
  status: string;
  reviewed_by: string | null;
  resolution_note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type BrandRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  id: string;
  email: string;
};

function toModuleOption(row: ModuleRow): ChangeRequestModuleOption {
  return {
    id: row.id,
    title: row.title,
    moduleType: row.module_type,
    status: row.status,
  };
}

function safeStatus(status: string): ChangeRequestStatus {
  return isChangeRequestStatus(status) ? status : "REQUESTED";
}

function safeTargetType(targetType: string): ChangeRequestTargetType {
  return isChangeRequestTargetType(targetType) ? targetType : "MODULE";
}

export function toChangeRequestRecord(row: ChangeRequestRow): ChangeRequestRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    targetType: safeTargetType(row.target_type),
    targetId: row.target_id,
    sectionKey: row.section_key,
    questionId: row.question_id,
    requestedBy: row.requested_by,
    reason: row.reason,
    comment: row.comment,
    status: safeStatus(row.status),
    reviewedBy: row.reviewed_by,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBrandModulesForChangeRequests(brandId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_modules")
    .select("id, title, module_type, status")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ModuleRow[]).map(toModuleOption);
}

export async function getChangeRequestCreateOptions(
  profileId: string,
): Promise<ChangeRequestCreateOptions | null> {
  const access = await getIntakeAccessForProfile({ profileId });

  if (!access) {
    return null;
  }

  const [session, sections, modules] = await Promise.all([
    getLatestIntakeSessionForBrand(access.brandId),
    getIntakeSectionsWithQuestions(),
    getBrandModulesForChangeRequests(access.brandId),
  ]);

  return {
    brandId: access.brandId,
    brandName: access.brandName,
    membershipRole: access.membershipRole,
    intakeLocked: Boolean(
      session && (session.status === "LOCKED" || session.lockedAt),
    ),
    sections,
    modules,
  };
}

export async function getChangeRequestById(requestId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("change_requests")
    .select(
      "id, brand_id, target_type, target_id, section_key, question_id, requested_by, reason, comment, status, reviewed_by, resolution_note, created_at, updated_at",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toChangeRequestRecord(data as unknown as ChangeRequestRow) : null;
}

export async function getAdminChangeRequests(): Promise<
  ChangeRequestReviewItem[]
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("change_requests")
    .select(
      "id, brand_id, target_type, target_id, section_key, question_id, requested_by, reason, comment, status, reviewed_by, resolution_note, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  const requests = ((data ?? []) as ChangeRequestRow[]).map(
    toChangeRequestRecord,
  );

  if (requests.length === 0) {
    return [];
  }

  const brandIds = Array.from(new Set(requests.map((request) => request.brandId)));
  const profileIds = Array.from(
    new Set(
      requests.flatMap((request) =>
        [request.requestedBy, request.reviewedBy].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ),
  );
  const [brandsResult, profilesResult, sections] = await Promise.all([
    admin.from("brands").select("id, name").in("id", brandIds),
    profileIds.length > 0
      ? admin.from("users_profile").select("id, email").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    getIntakeSectionsWithQuestions(),
  ]);

  if (brandsResult.error) {
    throw brandsResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const brands = new Map(
    ((brandsResult.data ?? []) as BrandRow[]).map((brand) => [
      brand.id,
      brand.name,
    ]),
  );
  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.email,
    ]),
  );
  const modulesByBrand = new Map<string, ChangeRequestModuleOption[]>();

  await Promise.all(
    brandIds.map(async (brandId) => {
      modulesByBrand.set(
        brandId,
        await getBrandModulesForChangeRequests(brandId),
      );
    }),
  );

  return sortChangeRequestsByCreatedAt(
    requests.map((request) => ({
      ...request,
      brandName: brands.get(request.brandId) ?? "Unknown brand",
      requesterEmail: request.requestedBy
        ? profiles.get(request.requestedBy) ?? null
        : null,
      reviewerEmail: request.reviewedBy
        ? profiles.get(request.reviewedBy) ?? null
        : null,
      targetLabel: targetLabelForRequest({
        request,
        sections,
        modules: modulesByBrand.get(request.brandId) ?? [],
      }),
    })),
  );
}
