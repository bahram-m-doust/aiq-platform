import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SetBreadcrumbLabels } from "@/components/app/breadcrumb-labels";
import {
  cityModelDistrictPath,
  getCityModelDistrictBySlug,
} from "@/features/app/city-model";
import { requireUserProfile } from "@/features/auth/queries";
import { CityModelDistrictView } from "@/features/city-model-deliverables/components/CityModelDistrictView";
import { getCityModelDistrictWorkspace } from "@/features/city-model-deliverables/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "City Model · District | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function CityModelDistrictPage({
  params,
}: {
  params: Promise<{ districtSlug: string }>;
}) {
  const { districtSlug } = await params;
  const district = getCityModelDistrictBySlug(districtSlug);
  if (!district) {
    notFound();
  }

  const { profile } = await requireUserProfile(
    cityModelDistrictPath(districtSlug),
  );
  const workspace = await getCityModelDistrictWorkspace({
    profileId: profile.id,
    slug: districtSlug,
  });
  if (!workspace) {
    redirect(ROUTES.brainRoadmapCityModel);
  }

  return (
    <>
      <SetBreadcrumbLabels
        labels={{ [cityModelDistrictPath(districtSlug)]: district.name }}
      />
      <CityModelDistrictView
        currentUserId={profile.id}
        slug={districtSlug}
        workspace={workspace}
      />
    </>
  );
}
