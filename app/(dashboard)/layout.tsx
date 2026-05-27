import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { logout } from "@/features/auth/actions";
import { requireUserProfile } from "@/features/auth/queries";
import {
  catalogAgentDefinitions,
} from "@/features/agents/catalog/schema";
import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";

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

      sidebarProps = {
        email: user.email ?? profile.email,
        fullName: profile.full_name,
        role: profile.global_role,
        brandName: accessSummary.brandName,
        agents: agents.map((a) => ({
          key: a.key,
          name: a.name,
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
    <div className="flex min-h-svh" style={{ background: "var(--bv-bg)" }}>
      <Sidebar
        {...sidebarProps}
        logoutAction={
          <form action={logout}>
            <Button
              className="w-full justify-start gap-2.5 text-[13px] text-[var(--bv-ink-3)] hover:text-[var(--bv-ink)]"
              size="sm"
              type="submit"
              variant="ghost"
            >
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
              Sign out
            </Button>
          </form>
        }
      />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
