import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ds/PageShell";
import { PaginationControls } from "@/components/PaginationControls";
import { requireUserProfile } from "@/features/auth/queries";
import { ClientModuleList } from "@/features/modules/components/ClientModuleList";
import { getClientModulesWorkspace } from "@/features/modules/queries";
import { paginationInputFromSearchParams } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Strategies | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function ModulesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireUserProfile("/modules");
  const workspace = await getClientModulesWorkspace(
    profile.id,
    paginationInputFromSearchParams((await searchParams) ?? {}),
  );

  if (!workspace) {
    redirect("/");
  }

  return (
    <PageShell
      eyebrow="Strategy Review"
      maxWidth="6xl"
      subtitle={`Review and approve strategy modules drafted by the AIQ STUDIO team for ${workspace.access.brandName}.`}
      title="Brand Strategies"
    >
      <ClientModuleList workspace={workspace} />
      <PaginationControls
        basePath="/modules"
        pagination={workspace.pagination}
      />
    </PageShell>
  );
}
