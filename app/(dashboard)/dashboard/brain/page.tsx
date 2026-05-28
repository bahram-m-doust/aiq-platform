import type { Metadata } from "next";

import { PageShell } from "@/components/ds/PageShell";
import { BrainChat } from "@/features/agents/brain/components/BrainChat";
import { BrainLockedState } from "@/features/agents/brain/components/BrainLockedState";
import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Brand Brain | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function BrandBrainPage() {
  const { profile } = await requireUserProfile("/dashboard/brain");
  const workspace = await getBrandBrainWorkspace(profile.id);

  return (
    <PageShell
      eyebrow="Brand Integrator Brain"
      maxWidth="6xl"
      subtitle={
        workspace.access
          ? `Ask strategic questions against the approved knowledge base for ${workspace.access.brandName}.`
          : "Ask strategic questions against your brand knowledge base."
      }
      title="Brand Brain"
    >
      {workspace.readiness.isReady && workspace.access ? (
        <BrainChat access={workspace.access} />
      ) : (
        <BrainLockedState
          access={workspace.access}
          readiness={workspace.readiness}
        />
      )}
    </PageShell>
  );
}
