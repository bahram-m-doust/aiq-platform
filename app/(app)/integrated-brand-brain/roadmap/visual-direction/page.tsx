import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import { AestheticsDeliverableView } from "@/features/aesthetics/components/AestheticsDeliverableView";
import { getAestheticsWorkspace } from "@/features/aesthetics/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Visual Direction | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function VisualDirectionPage() {
  const { profile } = await requireUserProfile(
    ROUTES.brainRoadmapVisualDirection,
  );
  const workspace = await getAestheticsWorkspace({
    profileId: profile.id,
    kind: "VISUAL_DIRECTION",
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
