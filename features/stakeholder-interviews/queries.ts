import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { createPrivateFileSignedDownloadUrl } from "@/features/documents/storage";
import { canReviewStakeholderInterviewRole } from "@/features/stakeholder-interviews/schema";
import type {
  StakeholderAnnotation,
  StakeholderInterviewReport,
  StakeholderInterviewWorkspace,
  StakeholderReportStatus,
} from "@/features/stakeholder-interviews/types";
import { createAdminClient } from "@/lib/supabase/admin";

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

type AnnotationRow = {
  id: string;
  report_id: string;
  author_id: string | null;
  page: number;
  pos_x: number | string;
  pos_y: number | string;
  body: string;
  resolved: boolean;
  created_at: string | null;
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

export async function getStakeholderReportRowByBrand(
  brandId: string,
): Promise<ReportRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stakeholder_interview_reports")
    .select("id, brand_id, file_id, status, uploaded_at, approved_at")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw error;
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
      annotations: [],
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
  const canReview = canReviewStakeholderInterviewRole(access.membershipRole);

  const reportRow = await getStakeholderReportRowByBrand(access.brandId);
  if (!reportRow) {
    return { access, report: null, annotations: [], signedUrl: null, canReview };
  }

  const admin = createAdminClient();
  const [fileResult, annotationsResult] = await Promise.all([
    reportRow.file_id
      ? admin
          .from("files")
          .select("id, storage_path, original_name, mime_type, size_bytes")
          .eq("id", reportRow.file_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("stakeholder_interview_annotations")
      .select(
        "id, report_id, author_id, page, pos_x, pos_y, body, resolved, created_at",
      )
      .eq("report_id", reportRow.id)
      .order("created_at", { ascending: true }),
  ]);
  if (fileResult.error) throw fileResult.error;
  if (annotationsResult.error) throw annotationsResult.error;

  const fileRow = (fileResult.data as FileRow | null) ?? null;
  const annotations: StakeholderAnnotation[] = (
    (annotationsResult.data ?? []) as AnnotationRow[]
  ).map((row) => ({
    id: row.id,
    reportId: row.report_id,
    authorId: row.author_id,
    authorEmail: null,
    page: row.page,
    posX: Number(row.pos_x),
    posY: Number(row.pos_y),
    body: row.body,
    resolved: row.resolved,
    createdAt: row.created_at,
  }));

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

  const signedUrl = fileRow
    ? await createPrivateFileSignedDownloadUrl({
        storagePath: fileRow.storage_path,
        downloadName: fileRow.original_name,
      })
    : null;

  return { access, report, annotations, signedUrl, canReview };
}
