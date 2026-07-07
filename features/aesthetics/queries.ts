import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { canReviewAestheticsRole } from "@/features/aesthetics/schema";
import type {
  AestheticsDeliverableReport,
  AestheticsDeliverableStatus,
  AestheticsWorkspace,
} from "@/features/aesthetics/types";
import { resolveReviewSurface } from "@/features/review-content/surface";
import type { ReviewSubjectType } from "@/features/review-comments/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/supabase/errors";
import { type AestheticsKind } from "@/lib/routes";

type DeliverableRow = {
  id: string;
  brand_id: string;
  kind: string;
  file_id: string | null;
  status: string;
  uploaded_at: string | null;
  approved_at: string | null;
};

type FileRow = {
  id: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
};

function toStatus(value: string): AestheticsDeliverableStatus {
  if (
    value === "CLIENT_REVIEW" ||
    value === "CHANGES_REQUESTED" ||
    value === "APPROVED"
  ) {
    return value;
  }
  return "PENDING_UPLOAD";
}

function isAestheticsKind(value: string): value is AestheticsKind {
  return value === "VISUAL_DIRECTION" || value === "COLOR_TYPE_SYSTEM" || value === "ASSET_LIBRARY";
}

export type AestheticsAdminBrandRow = {
  brandId: string;
  brandName: string;
  kind: AestheticsKind;
  status: AestheticsDeliverableStatus | "NONE";
  fileName: string | null;
  uploadedAt: string | null;
};

export async function getAestheticsAdminOverview(): Promise<
  AestheticsAdminBrandRow[]
> {
  const admin = createAdminClient();
  const [brandsResult, deliverablesResult] = await Promise.all([
    admin.from("brands").select("id, name").order("name", { ascending: true }),
    admin
      .from("aesthetics_deliverables")
      .select("brand_id, kind, status, uploaded_at, file_id"),
  ]);
  if (brandsResult.error) throw brandsResult.error;
  if (deliverablesResult.error && !isMissingTableError(deliverablesResult.error)) {
    throw deliverablesResult.error;
  }

  const rows = (deliverablesResult.data ?? []) as Array<{
    brand_id: string;
    kind: string;
    status: string;
    uploaded_at: string | null;
    file_id: string | null;
  }>;

  const byBrandKind = new Map(
    rows.map((row) => [`${row.brand_id}::${row.kind}`, row]),
  );

  const fileIds = rows
    .map((row) => row.file_id)
    .filter((id): id is string => Boolean(id));
  const fileNames = new Map<string, string>();
  if (fileIds.length > 0) {
    const { data, error } = await admin
      .from("files")
      .select("id, original_name")
      .in("id", fileIds);
    if (error) throw error;
    for (const file of (data ?? []) as Array<{ id: string; original_name: string }>) {
      fileNames.set(file.id, file.original_name);
    }
  }

  const brands = (brandsResult.data ?? []) as Array<{ id: string; name: string }>;
  const kinds: AestheticsKind[] = ["VISUAL_DIRECTION", "COLOR_TYPE_SYSTEM", "ASSET_LIBRARY"];
  const result: AestheticsAdminBrandRow[] = [];

  for (const brand of brands) {
    for (const kind of kinds) {
      const row = byBrandKind.get(`${brand.id}::${kind}`);
      result.push({
        brandId: brand.id,
        brandName: brand.name,
        kind,
        status: row ? toStatus(row.status) : "NONE",
        fileName: row?.file_id ? (fileNames.get(row.file_id) ?? null) : null,
        uploadedAt: row?.uploaded_at ?? null,
      });
    }
  }

  return result;
}

export async function getAestheticsRowsByBrand(
  brandId: string,
): Promise<DeliverableRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("aesthetics_deliverables")
    .select("id, brand_id, kind, file_id, status, uploaded_at, approved_at")
    .eq("brand_id", brandId);
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data as DeliverableRow[]) ?? [];
}

export async function getAestheticsRowByBrandAndKind(
  brandId: string,
  kind: AestheticsKind,
): Promise<DeliverableRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("aesthetics_deliverables")
    .select("id, brand_id, kind, file_id, status, uploaded_at, approved_at")
    .eq("brand_id", brandId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return (data as DeliverableRow | null) ?? null;
}

// Maps AestheticsKind to the corresponding ReviewSubjectType (they share names).
function kindToSubjectType(kind: AestheticsKind): ReviewSubjectType {
  return kind as ReviewSubjectType;
}

export async function getAestheticsWorkspace({
  profileId,
  kind,
}: {
  profileId: string;
  kind: AestheticsKind;
}): Promise<AestheticsWorkspace> {
  const accessSummary = await getBrandAccessSummaryForProfile(profileId);
  if (
    accessSummary.status !== "ACTIVE_ACCESS" ||
    !accessSummary.brandId ||
    !accessSummary.brandName
  ) {
    return {
      access: null,
      kind,
      report: null,
      markdown: null,
      comments: [],
      signedUrl: null,
      inlineUrl: null,
      canReview: false,
    };
  }

  const access = {
    brandId: accessSummary.brandId,
    brandName: accessSummary.brandName,
    membershipRole: accessSummary.membershipRole ?? "",
    planName: accessSummary.planName ?? null,
  };
  const canReview = canReviewAestheticsRole(access.membershipRole);

  const deliverableRow = await getAestheticsRowByBrandAndKind(
    access.brandId,
    kind,
  );
  if (!deliverableRow) {
    return {
      access,
      kind,
      report: null,
      markdown: null,
      comments: [],
      signedUrl: null,
      inlineUrl: null,
      canReview,
    };
  }

  const admin = createAdminClient();
  const fileResult = deliverableRow.file_id
    ? await admin
        .from("files")
        .select("id, storage_path, original_name, mime_type, size_bytes")
        .eq("id", deliverableRow.file_id)
        .maybeSingle()
    : { data: null, error: null };
  if (fileResult.error) throw fileResult.error;

  const fileRow = (fileResult.data as FileRow | null) ?? null;

  const surface = await resolveReviewSurface({
    subjectType: kindToSubjectType(kind),
    subjectId: deliverableRow.id,
    brandId: access.brandId,
    file: fileRow
      ? {
          id: fileRow.id,
          storagePath: fileRow.storage_path,
          originalName: fileRow.original_name,
          mimeType: fileRow.mime_type,
        }
      : null,
  });

  const rawKind = deliverableRow.kind;
  const resolvedKind: AestheticsKind = isAestheticsKind(rawKind) ? rawKind : kind;

  const report: AestheticsDeliverableReport = {
    id: deliverableRow.id,
    brandId: deliverableRow.brand_id,
    kind: resolvedKind,
    status: toStatus(deliverableRow.status),
    file: fileRow
      ? {
          id: fileRow.id,
          storagePath: fileRow.storage_path,
          originalName: fileRow.original_name,
          mimeType: fileRow.mime_type,
          sizeBytes: fileRow.size_bytes,
        }
      : null,
    uploadedAt: deliverableRow.uploaded_at,
    approvedAt: deliverableRow.approved_at,
  };

  return {
    access,
    kind,
    report,
    markdown: surface.markdown,
    comments: surface.comments,
    signedUrl: surface.signedUrl,
    inlineUrl: surface.inlineUrl,
    canReview,
  };
}
