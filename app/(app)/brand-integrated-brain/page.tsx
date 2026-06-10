import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ds/PageShell";
import { BrainChat } from "@/features/agents/brain/components/BrainChat";
import {
  getBrandBrainConversation,
  getBrandBrainWorkspace,
} from "@/features/agents/brain/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Brand Integrated Brain | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function BrandBrainPage() {
  const { profile } = await requireUserProfile("/brand-integrated-brain");
  const workspace = await getBrandBrainWorkspace(profile.id);

  // Until the brand brain is built (knowledge base synced), this destination
  // routes to the build workflow; it activates as the chat once ready.
  if (!workspace.readiness.isReady || !workspace.access || !workspace.agent) {
    redirect("/brand-integrated-brain/roadmap");
  }

  const initialMessages = await getBrandBrainConversation({
    brandId: workspace.access.brandId,
    agentId: workspace.agent.id,
    userId: profile.id,
  });

  return (
    <PageShell
      eyebrow="Brand Integrated Brain"
      maxWidth="6xl"
      subtitle={`Ask strategic questions against the approved knowledge base for ${workspace.access.brandName}.`}
      title="Brand Brain"
    >
      <BrainChat
        access={workspace.access}
        initialMessages={initialMessages}
      />
    </PageShell>
  );
}
