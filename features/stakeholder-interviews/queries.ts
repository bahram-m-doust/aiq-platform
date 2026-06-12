import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { resolveReviewSurface } from "@/features/review-content/surface";
import { canReviewStakeholderInterviewRole } from "@/features/stakeholder-interviews/schema";
import type {
  StakeholderInterviewReport,
  StakeholderInterviewWorkspace,
  StakeholderReportStatus,
} from "@/features/stakeholder-interviews/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/supabase/errors";

type ReportRow = {
  id: string;
  brand_id: string;
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

function toStatus(value: string): StakeholderReportStatus {
  if (
    value === "CLIENT_REVIEW" ||
    value === "CHANGES_REQUESTED" ||
    value === "APPROVED"
  ) {
    return value;
  }
  return "PENDING_UPLOAD";
}


export type StakeholderAdminBrandRow = {
  brandId: string;
  brandName: string;
  status: StakeholderReportStatus | "NONE";
  fileName: string | null;
  uploadedAt: string | null;
};

export async function getStakeholderAdminOverview(): Promise<
  StakeholderAdminBrandRow[]
> {
  const admin = createAdminClient();
  const [brandsResult, reportsResult] = await Promise.all([
    admin.from("brands").select("id, name").order("name", { ascending: true }),
    admin
      .from("stakeholder_interview_reports")
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

export async function getStakeholderReportRowByBrand(
  brandId: string,
): Promise<ReportRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stakeholder_interview_reports")
    .select("id, brand_id, file_id, status, uploaded_at, approved_at")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return (data as ReportRow | null) ?? null;
}

export async function getStakeholderInterviewWorkspace({
  profileId,
}: {
  profileId: string;
}): Promise<StakeholderInterviewWorkspace> {
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
  const canReview = canReviewStakeholderInterviewRole(access.membershipRole);

  const reportRow = await getStakeholderReportRowByBrand(access.brandId);
  if (!reportRow) {
    return {
      access,
      report: null,
      markdown: null,
      comments: [],
      signedUrl: null,
      inlineUrl: null,
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

  const surface = await resolveReviewSurface({
    subjectType: "STAKEHOLDER_INTERVIEWS",
    subjectId: reportRow.id,
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

  const report: StakeholderInterviewReport = {
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
    uploadedAt: reportRow.uploaded_at,
    approvedAt: reportRow.approved_at,
  };

  return {
    access,
    report,
    markdown: surface.markdown,
    comments: surface.comments,
    signedUrl: surface.signedUrl,
    inlineUrl: surface.inlineUrl,
    canReview,
  };
}
