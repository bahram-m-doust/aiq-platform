import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import { AestheticsDeliverableView } from "@/features/aesthetics/components/AestheticsDeliverableView";
import { getAestheticsWorkspace } from "@/features/aesthetics/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Color & Type System | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function ColorTypeSystemPage() {
  const { profile } = await requireUserProfile(
    ROUTES.brainRoadmapColorTypeSystem,
  );
  const workspace = await getAestheticsWorkspace({
    profileId: profile.id,
    kind: "COLOR_TYPE_SYSTEM",
  });

  if (!workspace.access) {
    redirect(ROUTES.brainRoadmap);
  }

  return (
    <AestheticsDeliverableView
      currentUserId={profile.id}
      workspace={workspace}
    />
  );
}
