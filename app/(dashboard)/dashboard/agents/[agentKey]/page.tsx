import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AgentDetail } from "@/features/agents/catalog/components/AgentDetail";
import { canActivateAgentRole } from "@/features/agents/catalog/schema";
import { getAgentCatalogDetail } from "@/features/agents/catalog/queries";
import { getAgentRunHistory } from "@/features/agents/runs/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Agent Detail | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AgentCatalogDetailPage({
  params,
}: {
  params: Promise<{ agentKey: string }>;
}) {
  const { agentKey } = await params;
  const { user, profile } = await requireUserProfile(
    `/dashboard/agents/${agentKey}`,
  );
  const detail = await getAgentCatalogDetail({
    profileId: profile.id,
    agentKey,
  });

  if (!detail || !canActivateAgentRole(detail.workspace.access.membershipRole)) {
    redirect("/dashboard/agents");
  }

  const email = user.email ?? profile.email;
  const runHistory =
    detail.agent.displayState === "ACTIVE" && detail.agent.agentId
      ? await getAgentRunHistory({
          brandId: detail.workspace.access.brandId,
          agentId: detail.agent.agentId,
        })
      : [];

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Agent Catalog
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            {detail.agent.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email} | {detail.workspace.access.brandName}
          </p>
        </div>

        <AgentDetail
          access={detail.workspace.access}
          agent={detail.agent}
          runHistory={runHistory}
        />

        <Button asChild variant="outline">
          <Link href="/dashboard/agents">Return to Agent Catalog</Link>
        </Button>
      </section>
    </main>
  );
}
