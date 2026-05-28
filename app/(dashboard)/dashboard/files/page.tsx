import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ds/PageShell";
import { PaginationControls } from "@/components/PaginationControls";
import { requireUserProfile } from "@/features/auth/queries";
import { FileList } from "@/features/files/components/FileList";
import { FileUploader } from "@/features/files/components/FileUploader";
import { getBrandFilesWorkspace } from "@/features/files/queries";
import { paginationInputFromSearchParams } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Files | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardFilesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireUserProfile("/dashboard/files");
  const workspace = await getBrandFilesWorkspace(
    profile.id,
    paginationInputFromSearchParams((await searchParams) ?? {}),
  );

  if (!workspace) {
    redirect("/dashboard");
  }

  return (
    <PageShell
      eyebrow="Secure Files"
      subtitle="Upload, review and share files for your brand workspace. All transfers use signed URLs."
      title="Brand File Workspace"
    >
      <FileUploader access={workspace.access} />
      <FileList
        access={workspace.access}
        files={workspace.files}
        profileId={profile.id}
      />
      <PaginationControls
        basePath="/dashboard/files"
        pagination={workspace.pagination}
      />
    </PageShell>
  );
}
