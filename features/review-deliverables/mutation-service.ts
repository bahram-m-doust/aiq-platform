import "server-only";

import { normalizeReviewPosition } from "@/features/review-deliverables/schema";
import { DomainError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

type AnnotationTable =
  | "stakeholder_interview_annotations"
  | "futures_research_annotations";
type ReportTable =
  | "stakeholder_interview_reports"
  | "futures_research_reports";

export type ReviewAnnotation = {
  id: string;
  reportId: string;
  parentId: string | null;
  authorId: string | null;
  authorName: null;
  authorEmail: null;
  page: number;
  posX: number;
  posY: number;
  body: string;
  resolved: boolean;
  createdAt: string | null;
};

function missingMutationTarget(): never {
  throw new DomainError(
    "review_deliverable_mutation",
    "The review item no longer exists or cannot be changed.",
  );
}

async function requireMutationResult(
  result: PromiseLike<{
    data: { id: string } | null;
    error: unknown;
  }>,
): Promise<void> {
  const { data, error } = await result;
  if (error) throw error;
  if (!data) missingMutationTarget();
}

export async function createReviewAnnotation({
  table,
  reportId,
  authorId,
  page,
  posX,
  posY,
  body,
  parentId = null,
}: {
  table: AnnotationTable;
  reportId: string;
  authorId: string;
  page: number;
  posX: number;
  posY: number;
  body: string;
  parentId?: string | null;
}): Promise<ReviewAnnotation> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(table)
    .insert({
      report_id: reportId,
      author_id: authorId,
      page,
      pos_x: normalizeReviewPosition(posX),
      pos_y: normalizeReviewPosition(posY),
      body,
      parent_id: parentId,
    })
    .select(
      "id, report_id, parent_id, author_id, page, pos_x, pos_y, body, resolved, created_at",
    )
    .single();

  if (error) throw error;

  const row = data as {
    id: string;
    report_id: string;
    parent_id: string | null;
    author_id: string | null;
    page: number;
    pos_x: number | string;
    pos_y: number | string;
    body: string;
    resolved: boolean;
    created_at: string | null;
  };

  return {
    id: row.id,
    reportId: row.report_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    authorName: null,
    authorEmail: null,
    page: row.page,
    posX: Number(row.pos_x),
    posY: Number(row.pos_y),
    body: row.body,
    resolved: row.resolved,
    createdAt: row.created_at,
  };
}

export async function updateReviewAnnotation({
  table,
  annotationId,
  reportId,
  authorId,
  body,
}: {
  table: AnnotationTable;
  annotationId: string;
  reportId: string;
  authorId: string;
  body: string;
}): Promise<void> {
  const admin = createAdminClient();
  await requireMutationResult(
    admin
      .from(table)
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", annotationId)
      .eq("report_id", reportId)
      .eq("author_id", authorId)
      .select("id")
      .maybeSingle(),
  );
}

export async function deleteReviewAnnotation({
  table,
  annotationId,
  reportId,
  authorId,
}: {
  table: AnnotationTable;
  annotationId: string;
  reportId: string;
  authorId: string;
}): Promise<void> {
  const admin = createAdminClient();
  await requireMutationResult(
    admin
      .from(table)
      .delete()
      .eq("id", annotationId)
      .eq("report_id", reportId)
      .eq("author_id", authorId)
      .select("id")
      .maybeSingle(),
  );
}

export async function setReviewAnnotationResolved({
  table,
  annotationId,
  reportId,
  resolved,
}: {
  table: AnnotationTable;
  annotationId: string;
  reportId: string;
  resolved: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  await requireMutationResult(
    admin
      .from(table)
      .update({ resolved, updated_at: new Date().toISOString() })
      .eq("id", annotationId)
      .eq("report_id", reportId)
      .select("id")
      .maybeSingle(),
  );
}

export async function setReviewReportStatus({
  table,
  brandId,
  profileId,
  status,
}: {
  table: ReportTable;
  brandId: string;
  profileId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
}): Promise<void> {
  const now = new Date().toISOString();
  const patch =
    status === "APPROVED"
      ? { status, approved_by: profileId, approved_at: now, updated_at: now }
      : { status, approved_by: null, approved_at: null, updated_at: now };
  const admin = createAdminClient();

  await requireMutationResult(
    admin
      .from(table)
      .update(patch)
      .eq("brand_id", brandId)
      .select("id")
      .maybeSingle(),
  );
}
