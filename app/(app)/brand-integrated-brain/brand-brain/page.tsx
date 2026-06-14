import type { Metadata } from "next";

import { PageShell } from "@/components/ds/PageShell";
import { BrainChat } from "@/features/agents/brain/components/BrainChat";
import { BrainLockedState } from "@/features/agents/brain/components/BrainLockedState";
import {
  getBrandBrainConversation,
  getBrandBrainWorkspace,
} from "@/features/agents/brain/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Brand Brain | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function BrandBrainPage() {
  const { profile } = await requireUserProfile(ROUTES.brainBrand);
  const workspace = await getBrandBrainWorkspace(profile.id);

  if (!workspace.readiness.isReady || !workspace.access || !workspace.agent) {
    return (
      <PageShell
        eyebrow="Brand Integrated Brain"
        maxWidth="5xl"
        subtitle="Brand Brain becomes available after your roadmap knowledge is ready."
        title="Brand Brain"
      >
        <BrainLockedState
          access={workspace.access}
          readiness={workspace.readiness}
        />
      </PageShell>
    );
  }

  const initialMessages = await getBrandBrainConversation({
    brandId: workspace.access.brandId,
    agentId: workspace.agent.id,
    userId: profile.id,
  });

  return (
    <BrainChat access={workspace.access} initialMessages={initialMessages} />
  );
}
