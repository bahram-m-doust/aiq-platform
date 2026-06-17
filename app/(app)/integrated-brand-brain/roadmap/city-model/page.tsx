import type { Metadata } from "next";

import { CityModelGrid } from "@/features/app/components/CityModelGrid";
import { requireUserProfile } from "@/features/auth/queries";
import { getCityModelDistrictStatuses } from "@/features/city-model-deliverables/queries";

export const metadata: Metadata = {
  title: "City Model | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function CityModelPage() {
  const { profile } = await requireUserProfile(
    "/integrated-brand-brain/roadmap/city-model",
  );
  const statuses = await getCityModelDistrictStatuses(profile.id);
  return <CityModelGrid availableKeys={Object.keys(statuses)} />;
}
