import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { createPrivateFileSignedDownloadUrl } from "@/features/documents/storage";
import { canReviewFuturesResearchRole } from "@/features/futures-research/schema";
import type {
  FuturesResearchReport,
  FuturesResearchReportStatus,
  FuturesResearchWorkspace,
} from "@/features/futures-research/types";
import { listCommentsForSubject } from "@/features/review-comments/queries";
import { resolveDeliverableMarkdown } from "@/features/review-content/resolve";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/supabase/errors";

type ReportRow = {
  id: string;
  brand_id: string;
  file_id: string | null;
  storyline_file_id: string | null;
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

function toStatus(value: string): FuturesResearchReportStatus {
  if (
    value === "CLIENT_REVIEW" ||
    value === "CHANGES_REQUESTED" ||
    value === "APPROVED"
  ) {
    return value;
  }
  return "PENDING_UPLOAD";
}


export type FuturesResearchAdminBrandRow = {
  brandId: string;
  brandName: string;
  status: FuturesResearchReportStatus | "NONE";
  fileName: string | null;
  uploadedAt: string | null;
};

export async function getFuturesResearchAdminOverview(): Promise<
  FuturesResearchAdminBrandRow[]
> {
  const admin = createAdminClient();
  const [brandsResult, reportsResult] = await Promise.all([
    admin.from("brands").select("id, name").order("name", { ascending: true }),
    admin
      .from("futures_research_reports")
      .select("brand_id, status, uploaded_at, file_id"),
  ]);
  if (brandsResult.error) throw brandsResult.error;
  if (reportsResult.error && !isMissingTableError(reportsResult.error)) {
    throw reportsResult.error;
  }

  const reportByBrand = new Map(
    (
      (reportsResult.data ?? []) as Array<{
        brand_id: string;
        status: string;
        uploaded_at: string | null;
        file_id: string | null;
      }>
    ).map((row) => [row.brand_id, row]),
  );

  const fileIds = [...reportByBrand.values()]
    .map((row) => row.file_id)
    .filter((id): id is string => Boolean(id));
  const fileNames = new Map<string, string>();
  if (fileIds.length > 0) {
    const { data, error } = await admin
      .from("files")
      .select("id, original_name")
      .in("id", fileIds);
    if (error) throw error;
    for (const file of (data ?? []) as Array<{
      id: string;
      original_name: string;
    }>) {
      fileNames.set(file.id, file.original_name);
    }
  }

  return ((brandsResult.data ?? []) as Array<{ id: string; name: string }>).map(
    (brand) => {
      const report = reportByBrand.get(brand.id);
      return {
        brandId: brand.id,
        brandName: brand.name,
        status: report ? toStatus(report.status) : "NONE",
        fileName: report?.file_id
          ? (fileNames.get(report.file_id) ?? null)
          : null,
        uploadedAt: report?.uploaded_at ?? null,
      };
    },
  );
}

export async function getFuturesResearchReportRowByBrand(
  brandId: string,
): Promise<ReportRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("futures_research_reports")
    .select(
      "id, brand_id, file_id, storyline_file_id, status, uploaded_at, approved_at",
    )
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return (data as ReportRow | null) ?? null;
}

// Resolves the stored Storyline HTML for a brand's report, authorized by
// brand ownership. Used by the streaming route that serves the file inline.
export async function getFuturesResearchStorylineFile({
  brandId,
  reportId,
}: {
  brandId: string;
  reportId: string;
}): Promise<{ storagePath: string; mimeType: string | null } | null> {
  const reportRow = await getFuturesResearchReportRowByBrand(brandId);
  if (!reportRow || reportRow.id !== reportId || !reportRow.storyline_file_id) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select("storage_path, mime_type")
    .eq("id", reportRow.storyline_file_id)
    .maybeSingle();
  if (error) throw error;
  const row = data as { storage_path: string; mime_type: string | null } | null;
  if (!row) return null;
  return { storagePath: row.storage_path, mimeType: row.mime_type };
}

export async function getFuturesResearchWorkspace({
  profileId,
}: {
  profileId: string;
}): Promise<FuturesResearchWorkspace> {
  const accessSummary = await getBrandAccessSummaryForProfile(profileId);
  if (
    accessSummary.status !== "ACTIVE_ACCESS" ||
    !accessSummary.brandId ||
    !accessSummary.brandName
  ) {
    return {
      access: null,
      report: null,
      markdown: null,
      comments: [],
      signedUrl: null,
      canReview: false,
    };
  }

  const access = {
    brandId: accessSummary.brandId,
    brandName: accessSummary.brandName,
    membershipRole: accessSummary.membershipRole ?? "",
    planName: accessSummary.planName ?? null,
  };
  const canReview = canReviewFuturesResearchRole(access.membershipRole);

  const reportRow = await getFuturesResearchReportRowByBrand(access.brandId);
  if (!reportRow) {
    return {
      access,
      report: null,
      markdown: null,
      comments: [],
      signedUrl: null,
      canReview,
    };
  }

  const admin = createAdminClient();
  const fileResult = reportRow.file_id
    ? await admin
        .from("files")
        .select("id, storage_path, original_name, mime_type, size_bytes")
        .eq("id", reportRow.file_id)
        .maybeSingle()
    : { data: null, error: null };
  if (fileResult.error) throw fileResult.error;

  const fileRow = (fileResult.data as FileRow | null) ?? null;

  const markdown = fileRow
    ? await resolveDeliverableMarkdown({
        fileId: fileRow.id,
        storagePath: fileRow.storage_path,
        mimeType: fileRow.mime_type,
        originalName: fileRow.original_name,
      })
    : null;

  const comments = await listCommentsForSubject({
    subjectType: "FUTURES_RESEARCH",
    subjectId: reportRow.id,
  });

  const report: FuturesResearchReport = {
    id: reportRow.id,
    brandId: reportRow.brand_id,
    status: toStatus(reportRow.status),
    file: fileRow
      ? {
          id: fileRow.id,
          storagePath: fileRow.storage_path,
          originalName: fileRow.original_name,
          mimeType: fileRow.mime_type,
          sizeBytes: fileRow.size_bytes,
        }
      : null,
    storylineFileId: reportRow.storyline_file_id,
    uploadedAt: reportRow.uploaded_at,
    approvedAt: reportRow.approved_at,
  };

  const signedUrl = fileRow
    ? await createPrivateFileSignedDownloadUrl({
        storagePath: fileRow.storage_path,
        downloadName: fileRow.original_name,
      })
    : null;

  return { access, report, markdown, comments, signedUrl, canReview };
}
