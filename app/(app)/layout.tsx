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
import {
  getUnreadNotificationCount,
  listNotificationsForProfile,
} from "@/features/notifications/queries";
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

  const [catalogWorkspace, brandIconUrl, notifications, unreadCount] =
    await Promise.all([
      catalogWorkspacePromise,
      accessSummary.brandId ? getBrandIconUrl(accessSummary.brandId) : null,
      listNotificationsForProfile({
        profileId: profile.id,
        globalRole: profile.global_role,
        brandId: accessSummary.brandId ?? null,
        // This is a brand's client workspace: show only this brand's inbox, not
        // the cross-brand INTERNAL_TEAM inbox (which lives in /admin) — even if
        // the signed-in user also holds an internal/platform-owner role.
        includeInternalTeamInbox: false,
      }).catch(() => []),
      getUnreadNotificationCount({
        profileId: profile.id,
        globalRole: profile.global_role,
        brandId: accessSummary.brandId ?? null,
        includeInternalTeamInbox: false,
      }).catch(() => 0),
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
            notifications={notifications}
            unreadCount={unreadCount}
            userName={profile.full_name ?? user.email ?? profile.email}
          />
          {/* overflow-x-clip (not hidden) prevents horizontal overflow without
              establishing a scroll container, so descendant `position: sticky`
              headers resolve against the document scroll. */}
          <div className="flex-1 overflow-x-clip p-4">{children}</div>
        </SidebarInset>
      </BreadcrumbLabelsProvider>
    </SidebarProvider>
  );
}
