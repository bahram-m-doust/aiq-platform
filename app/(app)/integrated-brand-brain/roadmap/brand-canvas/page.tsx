import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import { ROADMAP_PHASE_LABELS } from "@/features/app/roadmap-phase-labels";
import { requireUserProfile } from "@/features/auth/queries";
import { BrandDeliverablePlaceholderView } from "@/features/brand-deliverables/components/BrandDeliverablePlaceholderView";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Brand Canvas | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function BrandCanvasPage() {
  const { profile } = await requireUserProfile(ROUTES.brainRoadmapBrandCanvas);
  const workspace = await getBrandBrainWorkspace(profile.id);

  if (!workspace.access) {
    redirect(ROUTES.home);
  }

  return (
    <BrandDeliverablePlaceholderView
      body="AIQ STUDIO is consolidating the brand research into a clear strategic canvas. Once it is ready, this page will hold the reviewable source document that feeds the Brand Brain knowledge base."
      description="The Brand Canvas translates research signals into core strategic choices used as source material for the Brand Brain."
      eyebrow={ROADMAP_PHASE_LABELS.brandCanvas}
      headline="Brand Canvas in preparation"
      title="Brand Canvas"
    />
  );
}
