import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import { ROADMAP_PHASE_LABELS } from "@/features/app/roadmap-phase-labels";
import { requireUserProfile } from "@/features/auth/queries";
import { BrandDeliverablePlaceholderView } from "@/features/brand-deliverables/components/BrandDeliverablePlaceholderView";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Experience Book | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function ExperienceBookPage() {
  const { profile } = await requireUserProfile(
    ROUTES.brainRoadmapExperienceBook,
  );
  const workspace = await getBrandBrainWorkspace(profile.id);

  if (!workspace.access) {
    redirect(ROUTES.home);
  }

  return (
    <BrandDeliverablePlaceholderView
      body="AIQ STUDIO designers and strategists are shaping the Experience Book from approved research and strategy. Once it is ready, this page will hold the reviewable source document for the Brand Brain knowledge base."
      description="The Experience Book captures how the brand should feel, behave, and show up as reference material for the Brand Brain."
      eyebrow={ROADMAP_PHASE_LABELS.experienceBook}
      headline="Experience Book in preparation"
      title="Experience Book"
    />
  );
}
