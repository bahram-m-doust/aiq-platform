import { cache } from "react";

import { BreadcrumbLabelsProvider } from "@/components/app/breadcrumb-labels";
import { AppNavbar } from "@/components/app/AppNavbar";
import { Sidebar } from "@/components/app/Sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { brandIconPublicUrl } from "@/features/admin/brand-icons/storage";
import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";
import { catalogAgentDefinitions } from "@/features/agents/catalog/schema";
import { logout } from "@/features/auth/actions";
import { requireUserProfile } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const getBrandIconUrl = cache(async (brandId: string) => {
  const admin = createAdminClient();
  const { data: brandRow } = await admin
    .from("brands")
    .select("icon_path")
    .eq("id", brandId)
    .maybeSingle<{ icon_path: string | null }>();

  return brandIconPublicUrl(brandRow?.icon_path ?? null);
});

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireUserProfile("/home");
  const accessSummaryPromise = getBrandAccessSummaryForProfile(profile.id);
  const catalogWorkspacePromise = getAgentCatalogWorkspace(profile.id).catch(
    () => null,
  );
  const accessSummary = await accessSummaryPromise;

  if (accessSummary.status !== "ACTIVE_ACCESS") {
    return <>{children}</>;
  }

  const [catalogWorkspace, brandIconUrl] = await Promise.all([
    catalogWorkspacePromise,
    accessSummary.brandId ? getBrandIconUrl(accessSummary.brandId) : null,
  ]);
  const defByKey = new Map(
    catalogAgentDefinitions.map((definition) => [
      definition.key,
      definition,
    ]),
  );
  const sidebarProps = {
    email: user.email ?? profile.email,
    fullName: profile.full_name,
    role: profile.global_role,
    planName: accessSummary.planName,
    credits: accessSummary.credits,
    agents: (catalogWorkspace?.agents ?? []).map((agent) => ({
      key: agent.key,
      name: defByKey.get(agent.key)?.name ?? agent.name,
      slug: agent.slug,
      state: agent.displayState,
    })),
  };

  return (
    <SidebarProvider>
      <Sidebar {...sidebarProps} />
      <BreadcrumbLabelsProvider>
        <SidebarInset>
          <AppNavbar
            brandIconUrl={brandIconUrl}
            brandName={accessSummary.brandName}
            logoutAction={logout}
            userName={profile.full_name ?? user.email ?? profile.email}
          />
          <div className="flex-1 overflow-x-hidden p-4">{children}</div>
        </SidebarInset>
      </BreadcrumbLabelsProvider>
    </SidebarProvider>
  );
}
