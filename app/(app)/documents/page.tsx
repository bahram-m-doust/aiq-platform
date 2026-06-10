import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ds/PageShell";
import { PaginationControls } from "@/components/PaginationControls";
import { requireUserProfile } from "@/features/auth/queries";
import { DocumentList } from "@/features/documents/components/DocumentList";
import { DocumentUploader } from "@/features/documents/components/DocumentUploader";
import { getBrandDocumentsWorkspace } from "@/features/documents/queries";
import { paginationInputFromSearchParams } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Documents | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireUserProfile("/documents");
  const workspace = await getBrandDocumentsWorkspace(
    profile.id,
    paginationInputFromSearchParams((await searchParams) ?? {}),
  );

  if (!workspace) {
    redirect("/home");
  }

  return (
    <PageShell
      eyebrow="Secure Documents"
      subtitle="Upload, review and share documents for your brand workspace. All transfers use signed URLs."
      title="Brand Document Workspace"
    >
      <DocumentUploader access={workspace.access} />
      <DocumentList
        access={workspace.access}
        files={workspace.files}
        profileId={profile.id}
      />
      <PaginationControls
        basePath="/documents"
        pagination={workspace.pagination}
      />
    </PageShell>
  );
}
