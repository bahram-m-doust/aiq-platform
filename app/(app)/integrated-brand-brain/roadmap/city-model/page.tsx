import type { Metadata } from "next";

import { CityModelGrid } from "@/features/app/components/CityModelGrid";
import { requireUserProfile } from "@/features/auth/queries";
import { getCityModelDistrictStatuses } from "@/features/city-model-deliverables/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "City Model | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function CityModelPage() {
  const { profile } = await requireUserProfile(ROUTES.brainRoadmapCityModel);
  const statuses = await getCityModelDistrictStatuses(profile.id);
  return <CityModelGrid availableKeys={Object.keys(statuses)} />;
}
