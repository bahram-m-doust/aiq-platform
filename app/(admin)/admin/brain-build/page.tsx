import type { Metadata } from "next";

import { requirePlatformOwner } from "@/features/auth/queries";
import { getAdminBrandsForBrainBuild } from "@/features/admin/brain-build/queries";
import { BrainBuildAdminPanel } from "@/features/admin/brain-build/components/BrainBuildAdminPanel";

export const metadata: Metadata = {
  title: "Brain Build | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminBrainBuildPage() {
  const { profile } = await requirePlatformOwner("/admin/brain-build");
  const brands = await getAdminBrandsForBrainBuild();

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Platform owner
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Brain Build
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {profile.email}. Schedule and trigger brand brain
            builds. Each build runs the RAG sync pipeline and activates the
            brand&apos;s AI agent.
          </p>
        </div>

        {brands.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No brands found. Create a brand and assign members before scheduling
            a build.
          </p>
        ) : (
          <div className="space-y-4">
            {brands.map((brand) => (
              <div
                className="rounded-lg border border-border bg-card p-4 space-y-3"
                key={brand.brandId}
              >
                <h2 className="text-base font-semibold">{brand.brandName}</h2>
                <BrainBuildAdminPanel
                  brandId={brand.brandId}
                  brandName={brand.brandName}
                  schedule={brand.schedule}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
