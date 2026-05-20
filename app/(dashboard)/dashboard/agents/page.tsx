import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AgentCatalogList } from "@/features/agents/catalog/components/AgentCatalogList";
import { canActivateAgentRole } from "@/features/agents/catalog/schema";
import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Agent Catalog | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AgentCatalogPage() {
  const { user, profile } = await requireUserProfile("/dashboard/agents");
  const workspace = await getAgentCatalogWorkspace(profile.id);

  if (!workspace || !canActivateAgentRole(workspace.access.membershipRole)) {
    redirect("/dashboard");
  }

  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Agent Catalog
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Brand Agents
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email} | {workspace.access.brandName}
          </p>
        </div>

        <AgentCatalogList workspace={workspace} />

        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </section>
    </main>
  );
}

