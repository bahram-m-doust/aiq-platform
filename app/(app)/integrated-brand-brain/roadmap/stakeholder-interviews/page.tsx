import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import { StakeholderReviewView } from "@/features/stakeholder-interviews/components/StakeholderReviewView";
import { getStakeholderInterviewWorkspace } from "@/features/stakeholder-interviews/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Stakeholder Interviews | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function StakeholderInterviewsPage() {
  const { profile } = await requireUserProfile(
    ROUTES.brainRoadmapStakeholderInterviews,
  );
  const workspace = await getStakeholderInterviewWorkspace({
    profileId: profile.id,
  });

  if (!workspace.access) {
    redirect(ROUTES.brainRoadmap);
  }

  return (
    <StakeholderReviewView currentUserId={profile.id} workspace={workspace} />
  );
}
