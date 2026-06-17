import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function LegacyFuturesResearchPage() {
  redirect(ROUTES.brainRoadmapFuturesResearch);
}