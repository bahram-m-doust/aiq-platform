import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/PaginationControls";
import { requireUserProfile } from "@/features/auth/queries";
import { ModuleBoard } from "@/features/modules/components/ModuleBoard";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import { getAdminModuleBoard } from "@/features/modules/queries";
import { paginationInputFromSearchParams } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Module Board | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminModulesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, profile } = await requireUserProfile("/admin/modules");

  if (!canViewAdminModulesRole(profile.global_role)) {
    redirect("/dashboard");
  }

  const board = await getAdminModuleBoard(
    profile,
    paginationInputFromSearchParams((await searchParams) ?? {}),
  );
  const email = user.email ?? profile.email;

  if (!board) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Internal module workflow
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Module Board
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email} | {board.actorRole}
          </p>
        </div>

        <ModuleBoard
          actionLabel="Open module"
          basePath="/admin/modules"
          emptyDescription="Assigned and active brand modules will appear here."
          emptyTitle="No modules available"
          modules={board.modules}
        />
        <PaginationControls
          basePath="/admin/modules"
          pagination={board.pagination}
        />

        <Button asChild variant="outline">
          <Link href="/admin">Return to Admin</Link>
        </Button>
      </section>
    </main>
  );
}
