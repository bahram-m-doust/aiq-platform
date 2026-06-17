import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function LegacyCityModelDistrictPage({
  params,
}: {
  params: Promise<{ districtSlug: string }>;
}) {
  const { districtSlug } = await params;
  redirect(`${ROUTES.brainRoadmapCityModel}/${districtSlug}`);
}