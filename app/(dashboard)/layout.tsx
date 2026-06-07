import { cache } from "react";

import { BreadcrumbLabelsProvider } from "@/components/dashboard/breadcrumb-labels";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { brandIconPublicUrl } from "@/features/admin/brand-icons/storage";
import { logout } from "@/features/auth/actions";
import { requireUserProfile } from "@/features/auth/queries";
import {
  catalogAgentDefinitions,
} from "@/features/agents/catalog/schema";
import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";
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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let sidebarProps = null;
  let displayName = "";
  let brandName: string | null = null;
  let brandIconUrl: string | null = null;

  try {
    const { user, profile } = await requireUserProfile("/login");
    const accessSummaryPromise = getBrandAccessSummaryForProfile(profile.id);
    const catalogWorkspacePromise = getAgentCatalogWorkspace(profile.id).catch(
      () => null,
    );
    const accessSummary = await accessSummaryPromise;

    if (accessSummary.status === "ACTIVE_ACCESS") {
      const [catalogWorkspace, resolvedBrandIconUrl] = await Promise.all([
        catalogWorkspacePromise,
        accessSummary.brandId ? getBrandIconUrl(accessSummary.brandId) : null,
      ]);
      const agents = catalogWorkspace?.agents ?? [];

      const defByKey = new Map(
        catalogAgentDefinitions.map((d) => [d.key, d]),
      );

      displayName = profile.full_name ?? user.email ?? profile.email;
      brandName = accessSummary.brandName;
      brandIconUrl = resolvedBrandIconUrl;
      sidebarProps = {
        email: user.email ?? profile.email,
        fullName: profile.full_name,
        role: profile.global_role,
        planName: accessSummary.planName,
        credits: accessSummary.credits,
        agents: agents.map((a) => ({
          key: a.key,
          name: defByKey.get(a.key)?.name ?? a.name,
          slug: a.slug,
          state: a.displayState,
        })),
      };
    }
  } catch {
    // User not authenticated — render children without sidebar
  }

  if (!sidebarProps) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <Sidebar {...sidebarProps} />
      <BreadcrumbLabelsProvider>
        <SidebarInset>
          <DashboardNavbar
            brandIconUrl={brandIconUrl}
            brandName={brandName}
            logoutAction={logout}
            userName={displayName}
          />
          <div className="flex-1 overflow-x-hidden p-4">{children}</div>
        </SidebarInset>
      </BreadcrumbLabelsProvider>
    </SidebarProvider>
  );
}
