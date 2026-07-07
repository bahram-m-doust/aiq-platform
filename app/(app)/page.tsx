import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { AppLanding } from "@/features/app/components/AppLanding";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Home | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { profile } = await requireUserProfile(ROUTES.home);
  const workspace = await getAgentCatalogWorkspace(profile.id);

  // No active brand workspace yet - fall through to the Brain build flow.
  if (!workspace) {
    redirect(ROUTES.brain);
  }

  return <AppLanding workspace={workspace} />;
}
