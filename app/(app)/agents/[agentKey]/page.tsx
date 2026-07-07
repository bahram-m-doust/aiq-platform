import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetBreadcrumbLabels } from "@/components/app/breadcrumb-labels";
import { PageShell } from "@/components/ds/PageShell";
import { AgentDetail } from "@/features/agents/catalog/components/AgentDetail";
import { canActivateAgentRole } from "@/features/agents/catalog/schema";
import { getAgentCatalogDetail } from "@/features/agents/catalog/queries";
import { getAgentRunHistory } from "@/features/agents/runs/queries";
import { getBrandModelDefaults } from "@/features/agents/runs/services";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Agent Detail | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function AgentCatalogDetailPage({
  params,
}: {
  params: Promise<{ agentKey: string }>;
}) {
  const { agentKey } = await params;
  const { profile } = await requireUserProfile(
    `/agents/${agentKey}`,
  );
  const detail = await getAgentCatalogDetail({
    profileId: profile.id,
    agentKey,
  });

  if (!detail || !canActivateAgentRole(detail.workspace.access.membershipRole)) {
    redirect("/agents");
  }

  const runHistory =
    detail.agent.displayState === "ACTIVE" && detail.agent.agentId
      ? await getAgentRunHistory({
          brandId: detail.workspace.access.brandId,
          agentId: detail.agent.agentId,
        })
      : [];

  const defaults = await getBrandModelDefaults(
    detail.workspace.access.brandId,
  );

  return (
    <PageShell
      eyebrow="Agent"
      subtitle={detail.agent.description}
      title={detail.agent.name}
    >
      <SetBreadcrumbLabels
        labels={{ [`/agents/${agentKey}`]: detail.agent.name }}
      />
      <AgentDetail
        access={detail.workspace.access}
        agent={detail.agent}
        defaultImageModel={defaults.image}
        defaultTextModel={defaults.text}
        runHistory={runHistory}
      />
    </PageShell>
  );
}
