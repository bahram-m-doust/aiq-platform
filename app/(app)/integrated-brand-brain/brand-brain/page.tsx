import type { Metadata } from "next";

import { PageShell } from "@/components/ds/PageShell";
import { BrainChat } from "@/features/agents/brain/components/BrainChat";
import { BrainLockedState } from "@/features/agents/brain/components/BrainLockedState";
import { getBrandBrainModel } from "@/features/agents/brain/llm";
import {
  getBrandBrainRunSummaries,
  getBrandBrainWorkspace,
} from "@/features/agents/brain/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Brand Brain | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function BrandBrainPage() {
  const { profile } = await requireUserProfile(ROUTES.brainBrand);
  const workspace = await getBrandBrainWorkspace(profile.id);

  if (!workspace.readiness.isReady || !workspace.access || !workspace.agent) {
    return (
      <PageShell
        eyebrow="Integrated Brand Brain"
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

  // Fresh visits always open a clean New Chat. Past conversations live in the
  // sidebar and are loaded on demand when a session is clicked, so we only need
  // the session summaries here — not a merged dump of every run.
  const runSummaries = await getBrandBrainRunSummaries({
    brandId: workspace.access.brandId,
    agentId: workspace.agent.id,
    userId: profile.id,
  });

  return (
    <BrainChat
      access={workspace.access}
      model={getBrandBrainModel()}
      runSummaries={runSummaries}
    />
  );
}
