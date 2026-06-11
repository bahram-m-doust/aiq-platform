import "server-only";

import { DomainError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

type ReportTable =
  | "stakeholder_interview_reports"
  | "futures_research_reports";

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
