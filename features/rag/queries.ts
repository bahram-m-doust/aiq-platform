import "server-only";

import {
  eligibleRagArtifactStatuses,
  eligibleRagModuleStatuses,
  isEligibleRagArtifactStatus,
  isEligibleRagFileStatus,
  isEligibleRagModuleStatus,
  isRagApprovedSyncEligible,
  isRagSyncDisplayEligible,
  safeRagStatus,
} from "@/features/rag/schema";
import type {
  RagApprovalQueueItem,
  RagApprovedSyncFile,
  RagSyncBrandGroup,
  RagSyncFileItem,
  RagStatus,
} from "@/features/rag/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowOrNull, rowsOrEmpty } from "@/lib/supabase/rows";

type ModuleRow = {
  id: string;
  brand_id: string | null;
  module_type: string;
  title: string;
  status: string;
  updated_at: string | null;
};

type ArtifactRow = {
  id: string;
  module_id: string;
  artifact_type: string;
  file_id: string | null;
  version: number | null;
  status: string | null;
  created_at: string | null;
};

type FileRow = {
  id: string;
  brand_id: string | null;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  status: string;
};

type BrandRow = {
  id: string;
  name: string;
};

type KnowledgeFileRow = {
  id: string;
  brand_id: string;
  module_id: string | null;
  file_id: string | null;
  provider_file_id: string | null;
  rag_status: string;
  approved_by_supervisor: string | null;
  approved_by_platform_owner: string | null;
  synced_at: string | null;
  created_at: string | null;
};

type KnowledgeBaseRow = {
  id: string;
  brand_id: string;
  provider: string;
  provider_vector_store_id: string | null;
  status: string | null;
};

const moduleColumns = [
  "id",
  "brand_id",
  "module_type",
  "title",
  "status",
  "updated_at",
].join(", ");

const artifactColumns = [
  "id",
  "module_id",
  "artifact_type",
  "file_id",
  "version",
  "status",
  "created_at",
].join(", ");

const fileColumns = [
  "id",
  "brand_id",
  "storage_path",
  "original_name",
  "mime_type",
  "status",
].join(", ");

const knowledgeFileColumns = [
  "id",
  "brand_id",
  "module_id",
  "file_id",
  "provider_file_id",
  "rag_status",
  "approved_by_supervisor",
  "approved_by_platform_owner",
  "synced_at",
  "created_at",
].join(", ");

const knowledgeBaseColumns = [
  "id",
  "brand_id",
  "provider",
  "provider_vector_store_id",
  "status",
].join(", ");

function sortArtifacts(rows: ArtifactRow[]) {
  return [...rows].sort((left, right) => {
    const rightVersion = right.version ?? 0;
    const leftVersion = left.version ?? 0;

    if (rightVersion !== leftVersion) {
      return rightVersion - leftVersion;
    }

    const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
    const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
    return rightTime - leftTime;
  });
}

function toRagStatus(row: KnowledgeFileRow | null): RagStatus {
  return row ? safeRagStatus(row.rag_status) : "CLIENT_APPROVED";
}

function buildQueueItem({
  brand,
  brandModule,
  artifact,
  file,
  knowledgeFile,
}: {
  brand: BrandRow;
  brandModule: ModuleRow;
  artifact: ArtifactRow;
  file: FileRow;
  knowledgeFile: KnowledgeFileRow | null;
}): RagApprovalQueueItem | null {
  if (
    !brandModule.brand_id ||
    brandModule.brand_id !== brand.id ||
    artifact.artifact_type !== "PDF" ||
    !artifact.file_id ||
    artifact.file_id !== file.id ||
    file.brand_id !== brandModule.brand_id ||
    !isEligibleRagModuleStatus(brandModule.status) ||
    !isEligibleRagArtifactStatus(artifact.status) ||
    !isEligibleRagFileStatus(file.status)
  ) {
    return null;
  }

  return {
    brandId: brandModule.brand_id,
    brandName: brand.name,
    moduleId: brandModule.id,
    moduleTitle: brandModule.title,
    moduleType: brandModule.module_type,
    moduleStatus: brandModule.status,
    artifactId: artifact.id,
    artifactVersion: artifact.version ?? 1,
    artifactStatus: artifact.status ?? "CLIENT_APPROVED",
    fileId: file.id,
    fileName: file.original_name,
    fileStatus: file.status,
    knowledgeFileId: knowledgeFile?.id ?? null,
    ragStatus: toRagStatus(knowledgeFile),
    approvedBySupervisor: knowledgeFile?.approved_by_supervisor ?? null,
    approvedByPlatformOwner:
      knowledgeFile?.approved_by_platform_owner ?? null,
    createdAt: knowledgeFile?.created_at ?? null,
  };
}

async function fetchBrands(brandIds: string[]) {
  if (brandIds.length === 0) {
    return new Map<string, BrandRow>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .select("id, name")
    .in("id", brandIds);

  if (error) {
    throw error;
  }

  return new Map(
    rowsOrEmpty<BrandRow>(data).map((brand) => [brand.id, brand]),
  );
}

async function fetchFiles(fileIds: string[]) {
  if (fileIds.length === 0) {
    return new Map<string, FileRow>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select(fileColumns)
    .in("id", fileIds);

  if (error) {
    throw error;
  }

  return new Map(
    rowsOrEmpty<FileRow>(data).map((file) => [file.id, file]),
  );
}

async function fetchModules(moduleIds: string[]) {
  if (moduleIds.length === 0) {
    return new Map<string, ModuleRow>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_modules")
    .select(moduleColumns)
    .in("id", moduleIds);

  if (error) {
    throw error;
  }

  return new Map(
    rowsOrEmpty<ModuleRow>(data).map((row) => [row.id, row]),
  );
}

async function fetchKnowledgeFiles(fileIds: string[]) {
  if (fileIds.length === 0) {
    return new Map<string, KnowledgeFileRow>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_files")
    .select(knowledgeFileColumns)
    .in("file_id", fileIds);

  if (error) {
    throw error;
  }

  return new Map(
    rowsOrEmpty<KnowledgeFileRow>(data)
      .filter((row) => row.file_id)
      .map((row) => [`${row.brand_id}:${row.file_id}`, row]),
  );
}

async function fetchKnowledgeBases(brandIds: string[]) {
  if (brandIds.length === 0) {
    return new Map<string, KnowledgeBaseRow>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_bases")
    .select(knowledgeBaseColumns)
    .eq("provider", "OPENAI_FILE_SEARCH")
    .in("brand_id", brandIds);

  if (error) {
    throw error;
  }

  return new Map(
    rowsOrEmpty<KnowledgeBaseRow>(data).map((row) => [row.brand_id, row]),
  );
}

async function buildQueueItemsForModules(moduleRows: ModuleRow[]) {
  const eligibleModules = moduleRows.filter(
    (row) => row.brand_id && isEligibleRagModuleStatus(row.status),
  );

  if (eligibleModules.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const moduleIds = eligibleModules.map((row) => row.id);
  const { data: artifactData, error: artifactError } = await admin
    .from("module_artifacts")
    .select(artifactColumns)
    .in("module_id", moduleIds)
    .eq("artifact_type", "PDF")
    .in("status", [...eligibleRagArtifactStatuses])
    .order("version", { ascending: false })
    .order("created_at", { ascending: false });

  if (artifactError) {
    throw artifactError;
  }

  const artifactsByModuleId = rowsOrEmpty<ArtifactRow>(
    artifactData,
  ).reduce<Map<string, ArtifactRow[]>>((artifacts, artifact) => {
    if (!artifact.file_id || artifact.artifact_type !== "PDF") {
      return artifacts;
    }

    artifacts.set(artifact.module_id, [
      ...(artifacts.get(artifact.module_id) ?? []),
      artifact,
    ]);
    return artifacts;
  }, new Map());
  const selectedArtifacts = eligibleModules
    .map((brandModule) =>
      sortArtifacts(artifactsByModuleId.get(brandModule.id) ?? [])[0],
    )
    .filter((artifact): artifact is ArtifactRow => Boolean(artifact));
  const fileIds = Array.from(
    new Set(selectedArtifacts.map((artifact) => artifact.file_id as string)),
  );
  const brandIds = Array.from(
    new Set(
      eligibleModules
        .map((brandModule) => brandModule.brand_id)
        .filter((brandId): brandId is string => Boolean(brandId)),
    ),
  );
  const [brandsById, filesById, knowledgeFilesByBrandFile] = await Promise.all([
    fetchBrands(brandIds),
    fetchFiles(fileIds),
    fetchKnowledgeFiles(fileIds),
  ]);
  const artifactsByModule = new Map(
    selectedArtifacts.map((artifact) => [artifact.module_id, artifact]),
  );

  return eligibleModules
    .map((brandModule) => {
      const brand = brandModule.brand_id
        ? brandsById.get(brandModule.brand_id)
        : null;
      const artifact = artifactsByModule.get(brandModule.id) ?? null;
      const file = artifact?.file_id ? filesById.get(artifact.file_id) : null;
      const knowledgeFile =
        brandModule.brand_id && file
          ? knowledgeFilesByBrandFile.get(`${brandModule.brand_id}:${file.id}`) ??
            null
          : null;

      return brand && artifact && file
        ? buildQueueItem({
            brand,
            brandModule,
            artifact,
            file,
            knowledgeFile,
          })
        : null;
    })
    .filter((item): item is RagApprovalQueueItem => Boolean(item));
}

export async function getRagApprovalQueueItems() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_modules")
    .select(moduleColumns)
    .in("status", [...eligibleRagModuleStatuses])
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return buildQueueItemsForModules(rowsOrEmpty<ModuleRow>(data));
}

export async function getEligibleRagApprovalItemByArtifactId(
  artifactId: string,
) {
  const admin = createAdminClient();
  const { data: artifactData, error: artifactError } = await admin
    .from("module_artifacts")
    .select(artifactColumns)
    .eq("id", artifactId)
    .eq("artifact_type", "PDF")
    .maybeSingle();

  if (artifactError) {
    throw artifactError;
  }

  const artifact = rowOrNull<ArtifactRow>(artifactData);

  if (!artifact?.module_id || !artifact.file_id) {
    return null;
  }

  const { data: moduleData, error: moduleError } = await admin
    .from("brand_modules")
    .select(moduleColumns)
    .eq("id", artifact.module_id)
    .maybeSingle();

  if (moduleError) {
    throw moduleError;
  }

  const brandModule = rowOrNull<ModuleRow>(moduleData);

  if (!brandModule?.brand_id) {
    return null;
  }

  const [brandsById, filesById, knowledgeFilesByBrandFile] =
    await Promise.all([
      fetchBrands([brandModule.brand_id]),
      fetchFiles([artifact.file_id]),
      fetchKnowledgeFiles([artifact.file_id]),
    ]);
  const brand = brandsById.get(brandModule.brand_id);
  const file = filesById.get(artifact.file_id);
  const knowledgeFile = file
    ? knowledgeFilesByBrandFile.get(`${brandModule.brand_id}:${file.id}`) ?? null
    : null;

  return brand && file
    ? buildQueueItem({
        brand,
        brandModule,
        artifact,
        file,
        knowledgeFile,
      })
    : null;
}

async function fetchApprovedPdfArtifacts({
  moduleIds,
  fileIds,
}: {
  moduleIds: string[];
  fileIds: string[];
}) {
  if (moduleIds.length === 0 || fileIds.length === 0) {
    return new Map<string, ArtifactRow>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("module_artifacts")
    .select(artifactColumns)
    .eq("artifact_type", "PDF")
    .eq("status", "RAG_APPROVED")
    .in("module_id", moduleIds)
    .in("file_id", fileIds)
    .order("version", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return rowsOrEmpty<ArtifactRow>(data).reduce<Map<string, ArtifactRow>>((artifacts, artifact) => {
    if (!artifact.file_id) {
      return artifacts;
    }

    const key = `${artifact.module_id}:${artifact.file_id}`;

    if (!artifacts.has(key)) {
      artifacts.set(key, artifact);
    }

    return artifacts;
  }, new Map());
}

async function buildRagSyncFileItems(
  knowledgeRows: KnowledgeFileRow[],
  {
    approvedOnly,
  }: {
    approvedOnly: boolean;
  },
): Promise<RagSyncFileItem[]> {
  const fileIds = knowledgeRows
    .map((row) => row.file_id)
    .filter((fileId): fileId is string => Boolean(fileId));
  const moduleIds = knowledgeRows
    .map((row) => row.module_id)
    .filter((moduleId): moduleId is string => Boolean(moduleId));

  const [filesById, modulesById, artifactsByModuleFile] = await Promise.all([
    fetchFiles(fileIds),
    fetchModules(moduleIds),
    fetchApprovedPdfArtifacts({ moduleIds, fileIds }),
  ]);

  return knowledgeRows.flatMap((row) => {
    const file = row.file_id ? filesById.get(row.file_id) : null;
    const brandModule = row.module_id ? modulesById.get(row.module_id) : null;
    const artifact =
      row.module_id && row.file_id
        ? artifactsByModuleFile.get(`${row.module_id}:${row.file_id}`) ?? null
        : null;

    if (
      !file ||
      !brandModule ||
      !artifact ||
      !(approvedOnly ? isRagApprovedSyncEligible : isRagSyncDisplayEligible)({
        ragStatus: row.rag_status,
        fileStatus: file.status,
        brandMatches:
          file.brand_id === row.brand_id &&
          brandModule.brand_id === row.brand_id,
        moduleStatus: brandModule.status,
        artifactType: artifact.artifact_type,
        artifactStatus: artifact.status,
      })
    ) {
      return [];
    }

    return [
      {
        knowledgeFileId: row.id,
        brandId: row.brand_id,
        moduleId: row.module_id,
        artifactId: artifact.id,
        artifactVersion: artifact.version ?? 1,
        fileId: file.id,
        storagePath: file.storage_path,
        originalName: file.original_name,
        mimeType: file.mime_type,
        ragStatus: safeRagStatus(row.rag_status),
        providerFileId: row.provider_file_id,
        syncedAt: row.synced_at,
      },
    ];
  });
}

export async function getRagApprovedFilesForSync({
  brandId,
}: {
  brandId?: string;
} = {}): Promise<RagApprovedSyncFile[]> {
  const admin = createAdminClient();
  let query = admin
    .from("knowledge_files")
    .select(knowledgeFileColumns)
    .eq("rag_status", "RAG_APPROVED")
    .not("file_id", "is", null);

  if (brandId) {
    query = query.eq("brand_id", brandId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const items = await buildRagSyncFileItems(rowsOrEmpty<KnowledgeFileRow>(data), {
    approvedOnly: true,
  });

  return items.map(
    ({
      knowledgeFileId,
      brandId: itemBrandId,
      moduleId,
      artifactId,
      artifactVersion,
      fileId,
      storagePath,
      originalName,
      mimeType,
    }) => ({
      knowledgeFileId,
      brandId: itemBrandId,
      moduleId,
      artifactId,
      artifactVersion,
      fileId,
      storagePath,
      originalName,
      mimeType,
    }),
  );
}

export async function getRagSyncDashboard(): Promise<RagSyncBrandGroup[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_files")
    .select(knowledgeFileColumns)
    .in("rag_status", [
      "RAG_APPROVED",
      "SYNCING",
      "RAG_SYNCED",
      "SYNC_FAILED",
    ])
    .not("file_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const knowledgeRows = rowsOrEmpty<KnowledgeFileRow>(data);
  const brandIds = Array.from(new Set(knowledgeRows.map((row) => row.brand_id)));
  const [brandsById, knowledgeBasesByBrandId] = await Promise.all([
    fetchBrands(brandIds),
    fetchKnowledgeBases(brandIds),
  ]);

  const files = await buildRagSyncFileItems(knowledgeRows, {
    approvedOnly: false,
  });
  const filesByBrand = files.reduce<Map<string, RagSyncFileItem[]>>(
    (groups, file) => {
      groups.set(file.brandId, [...(groups.get(file.brandId) ?? []), file]);
      return groups;
    },
    new Map(),
  );

  return Array.from(filesByBrand.entries())
    .map(([groupBrandId, groupFiles]) => {
      const brand = brandsById.get(groupBrandId);
      const knowledgeBase = knowledgeBasesByBrandId.get(groupBrandId);

      return {
        brandId: groupBrandId,
        brandName: brand?.name ?? "Unknown brand",
        providerVectorStoreId:
          knowledgeBase?.provider_vector_store_id ?? null,
        knowledgeBaseStatus: knowledgeBase?.status ?? "NOT_READY",
        eligibleCount: groupFiles.filter(
          (file) => file.ragStatus === "RAG_APPROVED",
        ).length,
        syncingCount: groupFiles.filter((file) => file.ragStatus === "SYNCING")
          .length,
        syncedCount: groupFiles.filter(
          (file) => file.ragStatus === "RAG_SYNCED",
        ).length,
        failedCount: groupFiles.filter(
          (file) => file.ragStatus === "SYNC_FAILED",
        ).length,
        files: groupFiles,
      };
    })
    .sort((left, right) => left.brandName.localeCompare(right.brandName));
}
