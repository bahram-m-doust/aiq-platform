import type { Metadata } from "next";

import { PaginationControls } from "@/components/PaginationControls";
import { requirePlatformOwner } from "@/features/auth/queries";
import { BrandCard } from "@/features/admin/brands/components/BrandCard";
import { CreateBrandForm } from "@/features/admin/brands/components/CreateBrandForm";
import { getAdminBrandsWithMembers } from "@/features/admin/brands/queries";
import { paginationInputFromSearchParams } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Brands & Members | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, profile } = await requirePlatformOwner("/admin/brands");

  const { brands, pagination } = await getAdminBrandsWithMembers(
    paginationInputFromSearchParams((await searchParams) ?? {}),
  );
  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Platform owner
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Brands &amp; Members
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create brands, manage who belongs to each one, promote or demote
            their roles, and delete brands. Signed in as {email}.
          </p>
        </div>

        <CreateBrandForm />

        {brands.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No brands yet. Create the first one above.
          </p>
        ) : (
          <div className="space-y-4">
            {brands.map((brand) => (
              <BrandCard brand={brand} key={brand.id} />
            ))}
          </div>
        )}

        <PaginationControls basePath="/admin/brands" pagination={pagination} />
      </section>
    </main>
  );
}
