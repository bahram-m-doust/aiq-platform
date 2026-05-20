import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUserProfile } from "@/features/auth/queries";
import { ModuleArtifactList } from "@/features/modules/components/ModuleArtifactList";
import { ModuleArtifactUploadForm } from "@/features/modules/components/ModuleArtifactUploadForm";
import { ModuleReviewTimeline } from "@/features/modules/components/ModuleReviewTimeline";
import { ModuleStatusBadge } from "@/features/modules/components/ModuleStatusBadge";
import { SupervisorReviewPanel } from "@/features/modules/components/SupervisorReviewPanel";
import { getAdminModuleDetail } from "@/features/modules/queries";
import { canViewAdminModulesRole } from "@/features/modules/schema";

export const metadata: Metadata = {
  title: "Module Detail | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminModuleDetailPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  const { user, profile } = await requireUserProfile(
    `/admin/modules/${moduleId}`,
  );

  if (!canViewAdminModulesRole(profile.global_role)) {
    redirect("/dashboard");
  }

  const detail = await getAdminModuleDetail({ moduleId, profile });

  if (!detail) {
    redirect("/admin/modules");
  }

  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Internal module detail
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            {detail.module.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email} | {detail.actorRole}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>{detail.module.moduleTypeLabel}</CardTitle>
                <CardDescription>{detail.module.brandName}</CardDescription>
              </div>
              <ModuleStatusBadge status={detail.module.status} />
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Assigned to</dt>
                <dd>{detail.module.assignedToEmail ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Supervisor</dt>
                <dd>{detail.module.supervisorEmail ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Current version</dt>
                <dd className="font-mono">{detail.module.currentVersion}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <ModuleArtifactList artifacts={detail.artifacts} />
            <ModuleReviewTimeline reviews={detail.reviews} />
          </div>
          <div className="space-y-6">
            <ModuleArtifactUploadForm module={detail.module} />
            <SupervisorReviewPanel
              actorRole={detail.actorRole}
              latestArtifact={detail.latestArtifact}
              module={detail.module}
            />
          </div>
        </div>

        <Button asChild variant="outline">
          <Link href="/admin/modules">Return to Module Board</Link>
        </Button>
      </section>
    </main>
  );
}
