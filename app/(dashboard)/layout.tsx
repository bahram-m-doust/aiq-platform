import { Sidebar } from "@/components/dashboard/Sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { brandIconPublicUrl } from "@/features/admin/brand-icons/storage";
import { logout } from "@/features/auth/actions";
import { requireUserProfile } from "@/features/auth/queries";
import {
  catalogAgentDefinitions,
} from "@/features/agents/catalog/schema";
import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let sidebarProps = null;

  try {
    const { user, profile } = await requireUserProfile("/login");
    const accessSummary = await getBrandAccessSummaryForProfile(profile.id);

    if (accessSummary.status === "ACTIVE_ACCESS") {
      const catalogWorkspace = await getAgentCatalogWorkspace(profile.id);
      const agents = catalogWorkspace?.agents ?? [];

      const defByKey = new Map(
        catalogAgentDefinitions.map((d) => [d.key, d]),
      );

      let brandIconUrl: string | null = null;
      if (accessSummary.brandId) {
        const admin = createAdminClient();
        const { data: brandRow } = await admin
          .from("brands")
          .select("icon_path")
          .eq("id", accessSummary.brandId)
          .maybeSingle<{ icon_path: string | null }>();
        brandIconUrl = brandIconPublicUrl(brandRow?.icon_path ?? null);
      }

      sidebarProps = {
        email: user.email ?? profile.email,
        fullName: profile.full_name,
        role: profile.global_role,
        brandName: accessSummary.brandName,
        brandIconUrl,
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
      <Sidebar {...sidebarProps} logoutAction={logout} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="flex-1 overflow-x-hidden p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
