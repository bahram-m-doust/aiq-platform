import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import { AestheticsDeliverableView } from "@/features/aesthetics/components/AestheticsDeliverableView";
import { getAestheticsWorkspace } from "@/features/aesthetics/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Asset Library | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function AssetLibraryPage() {
  const { profile } = await requireUserProfile(ROUTES.brainRoadmapAssetLibrary);
  const workspace = await getAestheticsWorkspace({
    profileId: profile.id,
    kind: "ASSET_LIBRARY",
  });

  if (!workspace.access) {
    redirect(ROUTES.home);
  }

  return (
    <AestheticsDeliverableView
      currentUserId={profile.id}
      workspace={workspace}
    />
  );
}
