import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/PaginationControls";
import { requireUserProfile } from "@/features/auth/queries";
import { ClientModuleList } from "@/features/modules/components/ClientModuleList";
import { getClientModulesWorkspace } from "@/features/modules/queries";
import { paginationInputFromSearchParams } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Modules | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardModulesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, profile } = await requireUserProfile("/dashboard/modules");
  const workspace = await getClientModulesWorkspace(
    profile.id,
    paginationInputFromSearchParams((await searchParams) ?? {}),
  );

  if (!workspace) {
    redirect("/dashboard");
  }

  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Client module review
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Brand Modules
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email} | {workspace.access.brandName}
          </p>
        </div>

        <ClientModuleList workspace={workspace} />
        <PaginationControls
          basePath="/dashboard/modules"
          pagination={workspace.pagination}
        />

        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </section>
    </main>
  );
}
