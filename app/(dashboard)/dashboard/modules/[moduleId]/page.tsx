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
import { ClientReviewPanel } from "@/features/modules/components/ClientReviewPanel";
import { ModuleReviewTimeline } from "@/features/modules/components/ModuleReviewTimeline";
import { ModuleStatusBadge } from "@/features/modules/components/ModuleStatusBadge";
import { getClientModuleReviewPageData } from "@/features/modules/services";

export const metadata: Metadata = {
  title: "Module Review | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardModuleDetailPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  const { user, profile } = await requireUserProfile(
    `/dashboard/modules/${moduleId}`,
  );
  const data = await getClientModuleReviewPageData({
    moduleId,
    profile,
  });

  if (!data) {
    redirect("/dashboard/modules");
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
            {data.module.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email} | {data.access.brandName}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>{data.module.moduleTypeLabel}</CardTitle>
                <CardDescription>{data.module.brandName}</CardDescription>
              </div>
              <ModuleStatusBadge status={data.module.status} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Client approval records the final review decision for this
              module. It does not trigger Brand Brain sync or RAG approval.
            </p>
          </CardContent>
        </Card>

        <ClientReviewPanel data={data} />
        <ModuleReviewTimeline reviews={data.reviews} />

        <Button asChild variant="outline">
          <Link href="/dashboard/modules">Return to Modules</Link>
        </Button>
      </section>
    </main>
  );
}
