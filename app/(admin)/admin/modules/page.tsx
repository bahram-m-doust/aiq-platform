import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUserProfile } from "@/features/auth/queries";
import { ModuleArtifactUploadForm } from "@/features/modules/components/ModuleArtifactUploadForm";
import { ModuleStatusBadge } from "@/features/modules/components/ModuleStatusBadge";
import { getAdminModuleBrandGroups } from "@/features/modules/queries";

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
  const board = await getAdminModuleBrandGroups(profile);

  if (!board) {
    redirect("/dashboard");
  }

  const resolved = (await searchParams) ?? {};
  const brandIdParam = resolved.brandId;
  const selectedBrandId =
    typeof brandIdParam === "string" ? brandIdParam : undefined;
  const selectedGroup = selectedBrandId
    ? board.groups.find((group) => group.brandId === selectedBrandId)
    : undefined;
  const email = user.email ?? profile.email;

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
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pick a brand to upload module drafts for its modules.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {board.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No brand modules available.
            </p>
          ) : (
            board.groups.map((group) => {
              const isActive = group.brandId === selectedBrandId;
              return (
                <Button
                  asChild
                  key={group.brandId}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                >
                  <Link href={`/admin/modules?brandId=${group.brandId}`}>
                    {group.brandName}
                    <span className="ml-1.5 text-xs opacity-70">
                      {group.modules.length}
                    </span>
                  </Link>
                </Button>
              );
            })
          )}
        </div>

        {selectedGroup ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{selectedGroup.brandName}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {selectedGroup.modules.map((module) => (
                <div
                  className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-xs"
                  key={module.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{module.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {module.moduleTypeLabel}
                      </p>
                    </div>
                    <ModuleStatusBadge status={module.status} />
                  </div>

                  {module.latestArtifact ? (
                    <p className="text-xs text-muted-foreground">
                      Latest draft:{" "}
                      {module.latestArtifact.file?.originalName ??
                        `v${module.latestArtifact.version}`}
                    </p>
                  ) : null}

                  <ModuleArtifactUploadForm module={module} />

                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/admin/modules/${module.id}`}>
                      Open module →
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a brand to see its modules and upload drafts.
          </p>
        )}

        <Button asChild variant="outline">
          <Link href="/admin">Return to Admin</Link>
        </Button>
      </section>
    </main>
  );
}
