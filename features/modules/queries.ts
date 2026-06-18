import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import {
  canClientReviewModuleRole,
  canInternalUserAccessModule,
  canViewAdminModulesRole,
  isModuleArtifactType,
  isModuleReviewDecision,
  isModuleReviewType,
  moduleTypeLabel,
  safeModuleStatus,
} from "@/features/modules/schema";
import type {
  AdminModuleBoardData,
  AdminModuleBoardItem,
  AdminModuleBrandGroups,
  AdminModuleDetail,
  ClientModuleDetail,
  ClientModuleWorkspace,
  ModuleArtifactRecord,
  ModuleFileRecord,
  ModuleRecord,
  ModuleReviewRecord,
} from "@/features/modules/types";
import { isDocumentStatus, isDocumentVisibility } from "@/features/documents/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type PaginationInput,
  paginatedRows,
  toSupabaseRange,
} from "@/lib/pagination";
import { logServerError } from "@/lib/logging/server";
import { rowAsArray, rowsOrEmpty } from "@/lib/supabase/rows";
import { isUuid } from "@/lib/utils";
import type { UserProfile } from "@/features/auth/types";

type ModuleRow = {
  id: string;
  brand_id: string;
  module_type: string;
  title: string;
  status: string;
  assigned_to: string | null;
  supervisor_id: string | null;
  current_version: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ArtifactRow = {
  id: string;
  module_id: string;
  artifact_type: string;
  file_id: string | null;
  version: number | null;
  status: string | null;
  uploaded_by: string | null;
  created_at: string | null;
};

type FileRow = {
  id: string;
  brand_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | string | null;
  visibility: string;
  status: string;
  uploaded_by: string | null;
  created_at: string | null;
};

export type ReviewRow = {
  id: string;
  module_id: string;
  reviewer_id: string;
  review_type: string;
  decision: string;
  comment: string | null;
  created_at: string | null;
};

type BrandRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  id: string;
  email: string;
};

const moduleColumns = [
  "id",
  "brand_id",
  "module_type",
  "title",
  "status",
  "assigned_to",
  "supervisor_id",
  "current_version",
  "created_at",
  "updated_at",
].join(", ");

export const artifactColumns = [
  "id",
  "module_id",
  "artifact_type",
  "file_id",
  "version",
  "status",
  "uploaded_by",
  "created_at",
].join(", ");

const fileColumns = [
  "id",
  "brand_id",
  "storage_path",
  "original_name",
  "mime_type",
  "size_bytes",
  "visibility",
  "status",
  "uploaded_by",
  "created_at",
].join(", ");

export const reviewColumns = [
  "id",
  "module_id",
  "reviewer_id",
  "review_type",
  "decision",
  "comment",
  "created_at",
].join(", ");

const clientVisibleModuleStatuses = [
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
  "CLIENT_CHANGE_REQUESTED",
] as const;

function toSizeBytes(value: number | string | null) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function sortArtifacts(artifacts: ModuleArtifactRecord[]) {
  return [...artifacts].sort((left, right) => {
    if (right.version !== left.version) {
      return right.version - left.version;
    }

    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return rightTime - leftTime;
  });
}

export function getLatestModuleArtifact(artifacts: ModuleArtifactRecord[]) {
  return sortArtifacts(artifacts)[0] ?? null;
}

function safeFileVisibility(value: string) {
  return isDocumentVisibility(value) ? value : "HELIO_INTERNAL";
}

function safeFileStatus(value: string) {
  return isDocumentStatus(value) ? value : "UPLOADED";
}

function toModuleRecord({
  row,
  brandName,
  assignedToEmail,
  supervisorEmail,
}: {
  row: ModuleRow;
  brandName: string;
  assignedToEmail?: string | null;
  supervisorEmail?: string | null;
}): ModuleRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    brandName,
    moduleType: row.module_type,
    moduleTypeLabel: moduleTypeLabel(row.module_type),
    title: row.title,
    status: safeModuleStatus(row.status),
    assignedTo: row.assigned_to,
    assignedToEmail: assignedToEmail ?? null,
    supervisorId: row.supervisor_id,
    supervisorEmail: supervisorEmail ?? null,
    currentVersion: row.current_version ?? 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toModuleFileRecord({
  row,
  uploadedByEmail,
}: {
  row: FileRow;
  uploadedByEmail?: string | null;
}): ModuleFileRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    storagePath: row.storage_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: toSizeBytes(row.size_bytes),
    visibility: safeFileVisibility(row.visibility),
    status: safeFileStatus(row.status),
    uploadedBy: row.uploaded_by,
    uploadedByEmail: uploadedByEmail ?? null,
    createdAt: row.created_at,
  };
}

function toArtifactRecord({
  row,
  file,
  uploadedByEmail,
}: {
  row: ArtifactRow;
  file?: ModuleFileRecord | null;
  uploadedByEmail?: string | null;
}): ModuleArtifactRecord {
  return {
    id: row.id,
    moduleId: row.module_id,
    artifactType: isModuleArtifactType(row.artifact_type)
      ? row.artifact_type
      : "PDF",
    fileId: row.file_id,
    version: row.version ?? 1,
    status: row.status ?? "UPLOADED",
    uploadedBy: row.uploaded_by,
    uploadedByEmail: uploadedByEmail ?? null,
    createdAt: row.created_at,
    file: file ?? null,
  };
}

function toReviewRecord({
  row,
  reviewerEmail,
}: {
  row: ReviewRow;
  reviewerEmail?: string | null;
}): ModuleReviewRecord {
  return {
    id: row.id,
    moduleId: row.module_id,
    reviewerId: row.reviewer_id,
    reviewerEmail: reviewerEmail ?? null,
    reviewType: isModuleReviewType(row.review_type) ? row.review_type : "CLIENT",
    decision: isModuleReviewDecision(row.decision) ? row.decision : "COMMENT",
    comment: row.comment,
    createdAt: row.created_at,
  };
}

async function fetchBrandsById(brandIds: string[]) {
  // Only valid UUIDs may hit a uuid `.in("id", …)` — a stray malformed id would
  // make Postgres reject the whole batch with 22P02 (invalid_text_representation).
  const validIds = Array.from(new Set(brandIds.filter(isUuid)));
  if (validIds.length === 0) {
    return new Map<string, string>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .select("id, name")
    .in("id", validIds);

  if (error) {
    throw error;
  }

  return new Map(
    rowsOrEmpty<BrandRow>(data).map((brand) => [brand.id, brand.name]),
  );
}

async function fetchProfilesById(profileIds: string[]) {
  // Guard the uuid `.in("id", …)` against any malformed id (see fetchBrandsById).
  const validIds = Array.from(new Set(profileIds.filter(isUuid)));
  if (validIds.length === 0) {
    return new Map<string, string>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users_profile")
    .select("id, email")
    .in("id", validIds);

  if (error) {
    throw error;
  }

  return new Map(
    rowsOrEmpty<ProfileRow>(data).map((profile) => [
      profile.id,
      profile.email,
    ]),
  );
}

async function fetchFilesForArtifacts(artifactRows: ArtifactRow[]) {
  const fileIds = Array.from(
    new Set(artifactRows.map((artifact) => artifact.file_id).filter(isUuid)),
  );

  if (fileIds.length === 0) {
    return new Map<string, ModuleFileRecord>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select(fileColumns)
    .in("id", fileIds);

  if (error) {
    throw error;
  }

  const fileRows = rowsOrEmpty<FileRow>(data);
  const uploaderIds = Array.from(
    new Set(
      fileRows
        .map((file) => file.uploaded_by)
        .filter((profileId): profileId is string => Boolean(profileId)),
    ),
  );
  const profilesById = await fetchProfilesById(uploaderIds);

  return new Map(
    fileRows.map((file) => [
      file.id,
      toModuleFileRecord({
        row: file,
        uploadedByEmail: file.uploaded_by
          ? profilesById.get(file.uploaded_by) ?? null
          : null,
      }),
    ]),
  );
}

async function mapModuleRows(rows: ModuleRow[]) {
  // fetchBrandsById / fetchProfilesById validate the ids before querying.
  const brandIds = Array.from(new Set(rows.map((row) => row.brand_id)));
  const profileIds = Array.from(
    new Set(
      rows.flatMap((row) =>
        [row.assigned_to, row.supervisor_id].filter(
          (profileId): profileId is string => Boolean(profileId),
        ),
      ),
    ),
  );
  const [brandsById, profilesById] = await Promise.all([
    fetchBrandsById(brandIds),
    fetchProfilesById(profileIds),
  ]);

  return rows.map((row) =>
    toModuleRecord({
      row,
      brandName: brandsById.get(row.brand_id) ?? "Unknown brand",
      assignedToEmail: row.assigned_to
        ? profilesById.get(row.assigned_to) ?? null
        : null,
      supervisorEmail: row.supervisor_id
        ? profilesById.get(row.supervisor_id) ?? null
        : null,
    }),
  );
}

async function fetchArtifactsForModules(moduleIds: string[]) {
  const validIds = Array.from(new Set(moduleIds.filter(isUuid)));
  if (validIds.length === 0) {
    return new Map<string, ModuleArtifactRecord[]>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("module_artifacts")
    .select(artifactColumns)
    .in("module_id", validIds)
    .order("version", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = rowsOrEmpty<ArtifactRow>(data);
  const filesById = await fetchFilesForArtifacts(rows);
  const uploaderIds = Array.from(
    new Set(
      rows
        .map((artifact) => artifact.uploaded_by)
        .filter((profileId): profileId is string => Boolean(profileId)),
    ),
  );
  const profilesById = await fetchProfilesById(uploaderIds);

  return rows.reduce<Map<string, ModuleArtifactRecord[]>>((artifacts, row) => {
    const file = row.file_id ? filesById.get(row.file_id) ?? null : null;
    const record = toArtifactRecord({
      row,
      file,
      uploadedByEmail: row.uploaded_by
        ? profilesById.get(row.uploaded_by) ?? null
        : null,
    });
    const existing = artifacts.get(record.moduleId) ?? [];

    artifacts.set(record.moduleId, [...existing, record]);
    return artifacts;
  }, new Map());
}

async function fetchReviewsForModules(moduleIds: string[]) {
  if (moduleIds.length === 0) {
    return new Map<string, ModuleReviewRecord[]>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("module_reviews")
    .select(reviewColumns)
    .in("module_id", moduleIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = rowsOrEmpty<ReviewRow>(data);
  const reviewerIds = Array.from(
    new Set(rows.map((review) => review.reviewer_id)),
  );
  const profilesById = await fetchProfilesById(reviewerIds);

  return rows.reduce<Map<string, ModuleReviewRecord[]>>((reviews, row) => {
    const record = toReviewRecord({
      row,
      reviewerEmail: profilesById.get(row.reviewer_id) ?? null,
    });
    const existing = reviews.get(record.moduleId) ?? [];

    reviews.set(record.moduleId, [...existing, record]);
    return reviews;
  }, new Map());
}

export async function getAdminModuleBoard(
  profile: UserProfile,
  paginationInput?: PaginationInput,
): Promise<AdminModuleBoardData | null> {
  if (!canViewAdminModulesRole(profile.global_role)) {
    return null;
  }

  const admin = createAdminClient();
  const range = toSupabaseRange(paginationInput);
  let query = admin
    .from("brand_modules")
    .select(moduleColumns)
    .order("updated_at", { ascending: false })
    .range(range.from, range.to + 1);

  if (profile.global_role === "INTERNAL_SPECIALIST") {
    query = query.eq("assigned_to", profile.id);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const paginated = paginatedRows(rowsOrEmpty<ModuleRow>(data), range);
  const modules = await mapModuleRows(paginated.rows);
  const artifactsByModuleId = await fetchArtifactsForModules(
    modules.map((brandModule) => brandModule.id),
  );

  return {
    actorRole: profile.global_role,
    modules: modules.map((brandModule): AdminModuleBoardItem => {
      const artifacts = artifactsByModuleId.get(brandModule.id) ?? [];

      return {
        ...brandModule,
        latestArtifact: getLatestModuleArtifact(artifacts),
      };
    }),
    pagination: paginated.pagination,
  };
}

// Same data as the board, but ungated by pagination and grouped by brand so the
// admin can pick a brand and upload drafts for its modules in one place.
export async function getAdminModuleBrandGroups(
  profile: UserProfile,
  // The page shows one brand at a time, so only the selected brand's modules
  // get artifact enrichment — enriching every brand's modules is wasted work
  // (extra module_artifacts/files joins) that grows with the brand count.
  selectedBrandId?: string,
): Promise<AdminModuleBrandGroups | null> {
  if (!canViewAdminModulesRole(profile.global_role)) {
    return null;
  }

  const admin = createAdminClient();
  let query = admin
    .from("brand_modules")
    .select(moduleColumns)
    .order("updated_at", { ascending: false });

  if (profile.global_role === "INTERNAL_SPECIALIST") {
    query = query.eq("assigned_to", profile.id);
  }

  const { data, error } = await query;
  if (error) {
    // Surface the full Postgres error (code/message/details/hint) under a clear
    // label so it's findable in the server logs alongside the page's reference.
    logServerError({
      label: "[admin] module board query failed",
      error,
      metadata: { actorRole: profile.global_role },
    });
    throw error;
  }

  // This is a list query — use rowsOrEmpty, not rowAsArray (which is for a
  // single .maybeSingle() row and would wrap the whole array as one bad "row",
  // feeding `undefined` ids into `.in("id", …)` → 22P02).
  const rows = rowsOrEmpty<ModuleRow>(data);

  // The core module list has already loaded. The secondary brand/profile/
  // artifact lookups only enrich the display, so a failure there (e.g. a legacy
  // row whose id doesn't cast) must degrade gracefully — show the modules with
  // minimal data rather than crash the whole board.
  let modules: ModuleRecord[];
  let artifactsByModuleId: Map<string, ModuleArtifactRecord[]>;
  try {
    modules = await mapModuleRows(rows);
    artifactsByModuleId = await fetchArtifactsForModules(
      selectedBrandId
        ? modules
            .filter((brandModule) => brandModule.brandId === selectedBrandId)
            .map((brandModule) => brandModule.id)
        : [],
    );
  } catch (enrichError) {
    logServerError({
      label: "[admin] module board enrichment failed",
      error: enrichError,
      metadata: { actorRole: profile.global_role, moduleCount: rows.length },
    });
    modules = rows.map((row) =>
      toModuleRecord({ row, brandName: "Unknown brand" }),
    );
    artifactsByModuleId = new Map();
  }

  const groupByBrand = new Map<
    string,
    { brandId: string; brandName: string; modules: AdminModuleBoardItem[] }
  >();

  for (const brandModule of modules) {
    const item: AdminModuleBoardItem = {
      ...brandModule,
      latestArtifact: getLatestModuleArtifact(
        artifactsByModuleId.get(brandModule.id) ?? [],
      ),
    };

    let group = groupByBrand.get(brandModule.brandId);
    if (!group) {
      group = {
        brandId: brandModule.brandId,
        brandName: brandModule.brandName,
        modules: [],
      };
      groupByBrand.set(brandModule.brandId, group);
    }
    group.modules.push(item);
  }

  return {
    actorRole: profile.global_role,
    groups: Array.from(groupByBrand.values()).sort((a, b) =>
      a.brandName.localeCompare(b.brandName),
    ),
  };
}

export async function getModuleById(moduleId: string, brandId?: string) {
  // A non-UUID id (e.g. a mistyped URL segment) would make Postgres throw
  // 22P02 and crash the page — treat it as "not found" instead.
  if (!isUuid(moduleId)) {
    return null;
  }

  const admin = createAdminClient();
  let query = admin
    .from("brand_modules")
    .select(moduleColumns)
    .eq("id", moduleId);
  // Defense-in-depth: when the caller knows the brand (client surfaces), scope
  // the read so a mismatched id can never surface another brand's module, even
  // if a future refactor drops the post-fetch ownership check.
  if (brandId) {
    query = query.eq("brand_id", brandId);
  }
  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  const modules = await mapModuleRows(rowAsArray<ModuleRow>(data));
  return modules[0] ?? null;
}

export async function getAdminModuleDetail({
  moduleId,
  profile,
}: {
  moduleId: string;
  profile: UserProfile;
}): Promise<AdminModuleDetail | null> {
  if (!canViewAdminModulesRole(profile.global_role)) {
    return null;
  }

  const brandModule = await getModuleById(moduleId);

  if (
    !brandModule ||
    !canInternalUserAccessModule({
      actorRole: profile.global_role,
      profileId: profile.id,
      module: brandModule,
    })
  ) {
    return null;
  }

  const [artifactsByModuleId, reviewsByModuleId] = await Promise.all([
    fetchArtifactsForModules([brandModule.id]),
    fetchReviewsForModules([brandModule.id]),
  ]);
  const artifacts = sortArtifacts(
    artifactsByModuleId.get(brandModule.id) ?? [],
  );

  return {
    actorRole: profile.global_role,
    module: brandModule,
    artifacts,
    latestArtifact: artifacts[0] ?? null,
    reviews: reviewsByModuleId.get(brandModule.id) ?? [],
  };
}

function toClientAccessFromSummary(profileId: string) {
  return getBrandAccessSummaryForProfile(profileId).then((summary) => {
    if (
      summary.status !== "ACTIVE_ACCESS" ||
      !summary.brandId ||
      !summary.brandName ||
      !canClientReviewModuleRole(summary.membershipRole)
    ) {
      return null;
    }

    return {
      brandId: summary.brandId,
      brandName: summary.brandName,
      membershipRole: summary.membershipRole,
      planName: summary.planName,
    };
  });
}

export async function getClientModulesWorkspace(
  profileId: string,
  paginationInput?: PaginationInput,
): Promise<ClientModuleWorkspace | null> {
  const access = await toClientAccessFromSummary(profileId);

  if (!access) {
    return null;
  }

  const admin = createAdminClient();
  const range = toSupabaseRange(paginationInput);
  const { data, error } = await admin
    .from("brand_modules")
    .select(moduleColumns)
    .eq("brand_id", access.brandId)
    .in("status", [...clientVisibleModuleStatuses])
    .order("updated_at", { ascending: false })
    .range(range.from, range.to + 1);

  if (error) {
    throw error;
  }

  const paginated = paginatedRows(rowsOrEmpty<ModuleRow>(data), range);
  const modules = await mapModuleRows(paginated.rows);
  const artifactsByModuleId = await fetchArtifactsForModules(
    modules.map((brandModule) => brandModule.id),
  );

  return {
    access,
    modules: modules.map((brandModule): AdminModuleBoardItem => {
      const artifacts = artifactsByModuleId.get(brandModule.id) ?? [];

      return {
        ...brandModule,
        latestArtifact: getLatestModuleArtifact(artifacts),
      };
    }),
    pagination: paginated.pagination,
  };
}

export async function getClientModuleDetail({
  moduleId,
  profileId,
}: {
  moduleId: string;
  profileId: string;
}): Promise<ClientModuleDetail | null> {
  const access = await toClientAccessFromSummary(profileId);

  if (!access) {
    return null;
  }

  const brandModule = await getModuleById(moduleId, access.brandId);

  if (
    !brandModule ||
    brandModule.brandId !== access.brandId ||
    !clientVisibleModuleStatuses.includes(
      brandModule.status as (typeof clientVisibleModuleStatuses)[number],
    )
  ) {
    return null;
  }

  const [artifactsByModuleId, reviewsByModuleId] = await Promise.all([
    fetchArtifactsForModules([brandModule.id]),
    fetchReviewsForModules([brandModule.id]),
  ]);
  const artifacts = sortArtifacts(
    artifactsByModuleId.get(brandModule.id) ?? [],
  );
  const latestClientArtifact =
    artifacts.find(
      (artifact) =>
        artifact.artifactType === "PDF" &&
        artifact.file?.visibility === "CLIENT_REVIEW" &&
        (artifact.file.status === "CLIENT_REVIEW" ||
          artifact.file.status === "CLIENT_APPROVED"),
    ) ?? null;

  return {
    access,
    module: brandModule,
    artifacts,
    latestClientArtifact,
    reviews: reviewsByModuleId.get(brandModule.id) ?? [],
  };
}
