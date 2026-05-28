import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ds/PageShell";
import { PaginationControls } from "@/components/PaginationControls";
import { requireUserProfile } from "@/features/auth/queries";
import { ClientModuleList } from "@/features/modules/components/ClientModuleList";
import { getClientModulesWorkspace } from "@/features/modules/queries";
import { paginationInputFromSearchParams } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Strategies | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardModulesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireUserProfile("/dashboard/modules");
  const workspace = await getClientModulesWorkspace(
    profile.id,
    paginationInputFromSearchParams((await searchParams) ?? {}),
  );

  if (!workspace) {
    redirect("/dashboard");
  }

  return (
    <PageShell
      eyebrow="Strategy Review"
      maxWidth="6xl"
      subtitle={`Review and approve strategy modules drafted by the Bextudio team for ${workspace.access.brandName}.`}
      title="Brand Strategies"
    >
      <ClientModuleList workspace={workspace} />
      <PaginationControls
        basePath="/dashboard/modules"
        pagination={workspace.pagination}
      />
    </PageShell>
  );
}
