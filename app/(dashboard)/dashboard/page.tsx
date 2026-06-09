import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { DashboardLanding } from "@/features/dashboard/components/DashboardLanding";

export const metadata: Metadata = {
  title: "Home | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const { profile } = await requireUserProfile("/dashboard");
  const workspace = await getAgentCatalogWorkspace(profile.id);

  // No active brand workspace yet — fall through to the Brain build flow.
  if (!workspace) {
    redirect("/dashboard/brain");
  }

  return <DashboardLanding workspace={workspace} />;
}
