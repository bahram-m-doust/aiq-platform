import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function LegacyCityModelPage() {
  redirect(ROUTES.brainRoadmapCityModel);
}