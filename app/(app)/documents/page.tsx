import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PaginationControls } from "@/components/PaginationControls";
import { requireUserProfile } from "@/features/auth/queries";
import { DocumentList } from "@/features/documents/components/DocumentList";
import { DocumentUploader } from "@/features/documents/components/DocumentUploader";
import { getBrandDocumentsWorkspace } from "@/features/documents/queries";
import { paginationInputFromSearchParams } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Documents | AIQ Platform",
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
    redirect("/");
  }

  return (
    <main className="min-h-svh bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-6xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold leading-tight tracking-normal text-foreground sm:text-4xl">
            Files and assets
          </h1>
          <p className="max-w-2xl text-base font-normal leading-6 text-muted-foreground">
            Documents and attachments that have been uploaded as part of your
            brand workspace.
          </p>
        </header>

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
      </section>
    </main>
  );
}
