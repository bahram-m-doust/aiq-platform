import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ds/PageShell";
import { AgentCatalogList } from "@/features/agents/catalog/components/AgentCatalogList";
import { canActivateAgentRole } from "@/features/agents/catalog/schema";
import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Agents | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AgentCatalogPage() {
  const { profile } = await requireUserProfile("/dashboard/agents");
  const workspace = await getAgentCatalogWorkspace(profile.id);

  if (!workspace || !canActivateAgentRole(workspace.access.membershipRole)) {
    redirect("/dashboard");
  }

  return (
    <PageShell
      eyebrow="Agent Catalog"
      maxWidth="6xl"
      subtitle={`Activate brand-aware agents trained on ${workspace.access.brandName}'s knowledge base.`}
      title="Brand Agents"
    >
      <AgentCatalogList workspace={workspace} />
    </PageShell>
  );
}
