import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requirePlatformOwner } from "@/features/auth/queries";
import { AdminFilesConsole } from "@/features/files/components/AdminFilesConsole";
import { hasBrandApiKey } from "@/features/brands/api-keys";
import {
  getAdminBrandOptions,
  getFilesForBrand,
} from "@/features/files/admin-queries";

export const metadata: Metadata = {
  title: "Admin Files | Bextudio Platform",
};

export const dynamic = "force-dynamic";

function readSearchString(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

export default async function AdminFilesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requirePlatformOwner("/admin/files");
  const params = (await searchParams) ?? {};
  const requestedBrandId = readSearchString(params, "brand_id");
  const brands = await getAdminBrandOptions();
  const selectedBrandId = brands.some((brand) => brand.id === requestedBrandId)
    ? requestedBrandId
    : null;
  const [files, brandHasKey] = selectedBrandId
    ? await Promise.all([
        getFilesForBrand({ brandId: selectedBrandId }),
        hasBrandApiKey(selectedBrandId),
      ])
    : [[], false];

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
          <Button asChild variant="outline">
            <Link href="/admin">Admin overview</Link>
          </Button>
        </div>

        <AdminFilesConsole
          brands={brands}
          files={files}
          hasApiKey={brandHasKey}
          selectedBrandId={selectedBrandId}
        />
      </section>
    </main>
  );
}
