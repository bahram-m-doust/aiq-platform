import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { downloadPrivateFile } from "@/features/documents/storage";
import { getFuturesResearchStorylineFile } from "@/features/futures-research/queries";
import { storylineResponseHeaders } from "@/features/futures-research/storyline-security";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;

  const { profile } = await requireUserProfile(
    ROUTES.brainRoadmapFuturesResearch,
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
    headers: storylineResponseHeaders,
  });
}
