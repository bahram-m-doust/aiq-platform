import type { Metadata } from "next";

import { PaginationControls } from "@/components/PaginationControls";
import { requirePlatformOwner } from "@/features/auth/queries";
import { AdminDocumentsConsole } from "@/features/documents/components/AdminDocumentsConsole";
import { hasBrandApiKey } from "@/features/brands/api-keys";
import {
  getAdminBrandOptions,
  getDocumentsForBrand,
} from "@/features/documents/admin-queries";
import { paginationInputFromSearchParams } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Admin Documents | Bextudio Platform",
};

export const dynamic = "force-dynamic";

function readSearchString(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requirePlatformOwner("/admin/documents");
  const params = (await searchParams) ?? {};
  const requestedBrandId = readSearchString(params, "brand_id");
  const brands = await getAdminBrandOptions();
  const selectedBrandId = brands.some((brand) => brand.id === requestedBrandId)
    ? requestedBrandId
    : null;
  const [documents, brandHasKey] = selectedBrandId
    ? await Promise.all([
        getDocumentsForBrand({
          brandId: selectedBrandId,
          pagination: paginationInputFromSearchParams(params),
        }),
        hasBrandApiKey(selectedBrandId),
      ])
    : [null, false];
  const files = documents?.files ?? [];

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Platform owner
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              Brand Files
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Signed in as {profile.email}. All actions here are audited.
            </p>
          </div>
          
        </div>

        <AdminDocumentsConsole
          brands={brands}
          files={files}
          hasApiKey={brandHasKey}
          selectedBrandId={selectedBrandId}
        />
        {selectedBrandId && documents ? (
          <PaginationControls
            basePath="/admin/documents"
            pagination={documents.pagination}
            params={{ brand_id: selectedBrandId }}
          />
        ) : null}
      </section>
    </main>
  );
}
