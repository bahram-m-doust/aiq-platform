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
  parent_id?: string | null;
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

// Postgres "undefined_table" — the migration hasn't been applied yet. Treat it
// as "no report" so the roadmap and review page degrade gracefully.
function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "42P01"
  );
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
      .select("*")
      .eq("report_id", reportRow.id)
      .order("created_at", { ascending: true }),
  ]);
  if (fileResult.error) throw fileResult.error;
  if (annotationsResult.error) throw annotationsResult.error;

  const fileRow = (fileResult.data as FileRow | null) ?? null;
  const annotationRows = (annotationsResult.data ?? []) as AnnotationRow[];

  const authorIds = [
    ...new Set(
      annotationRows
        .map((row) => row.author_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const profileById = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  if (authorIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("users_profile")
      .select("id, full_name, email")
      .in("id", authorIds);
    if (profilesError) throw profilesError;
    for (const profile of (profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
    }>) {
      profileById.set(profile.id, {
        full_name: profile.full_name,
        email: profile.email,
      });
    }
  }

  const annotations: StakeholderAnnotation[] = annotationRows.map((row) => {
    const profile = row.author_id ? profileById.get(row.author_id) : undefined;
    return {
      id: row.id,
      reportId: row.report_id,
      parentId: row.parent_id ?? null,
      authorId: row.author_id,
      authorName: profile?.full_name ?? null,
      authorEmail: profile?.email ?? null,
      page: row.page,
      posX: Number(row.pos_x),
      posY: Number(row.pos_y),
      body: row.body,
      resolved: row.resolved,
      createdAt: row.created_at,
    };
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

  const signedUrl = fileRow
    ? await createPrivateFileSignedDownloadUrl({
        storagePath: fileRow.storage_path,
        downloadName: fileRow.original_name,
      })
    : null;

  return { access, report, annotations, signedUrl, canReview };
}
