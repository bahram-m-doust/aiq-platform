import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { downloadPrivateFile } from "@/features/documents/storage";
import { getFuturesResearchStorylineFile } from "@/features/futures-research/queries";

export const dynamic = "force-dynamic";

// Streams the brand's Futures Research Storyline HTML inline, authorized by
// brand membership. Served from our origin (not a signed URL) so it can be
// embedded in a stable iframe, and stays private behind the access check.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;

  const { profile } = await requireUserProfile(
    "/dashboard/brain/roadmap/futures-research",
  );
  const access = await getBrandAccessSummaryForProfile(profile.id);
  if (access.status !== "ACTIVE_ACCESS" || !access.brandId) {
    return new Response("Not found", { status: 404 });
  }

  const storyline = await getFuturesResearchStorylineFile({
    brandId: access.brandId,
    reportId,
  });
  if (!storyline) {
    return new Response("Not found", { status: 404 });
  }

  const blob = await downloadPrivateFile(storyline.storagePath);

  return new Response(blob, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
